import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { isUniqueConstraintError } from '../database/database-error';
import type { CreateClientDto } from './dto/create-client.dto';
import type { UpdateClientDto } from './dto/update-client.dto';
import type {
  ClientContactView,
  ClientKind,
  ClientProjectView,
  ClientStatus,
  ClientView,
} from './clients.types';

interface ClientRow {
  id: string;
  name: string;
  kind: ClientKind;
  status: ClientStatus;
  email: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  logo_data_url: string | null;
  created_at: string;
  updated_at: string;
}

interface ClientContactRow {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean | number;
  created_at: string;
  updated_at: string;
}

interface ClientProjectRow {
  id: string;
  name: string;
  repositories_count: number | string;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class ClientsService {
  constructor(private readonly database: DatabaseService) {}

  async create(input: CreateClientDto): Promise<ClientView> {
    const clientId = randomUUID();
    const now = new Date().toISOString();

    try {
      await this.database.connection.transaction(async (transaction) => {
        await transaction('clients').insert({
          id: clientId,
          name: input.name,
          kind: input.kind,
          status: input.status,
          email: input.email ?? null,
          phone: input.phone ?? null,
          website: input.website ?? null,
          notes: input.notes ?? null,
          logo_data_url: input.logoDataUrl ?? null,
          created_at: now,
          updated_at: now,
        });

        if (input.primaryContact) {
          await transaction('client_contacts').insert({
            id: randomUUID(),
            client_id: clientId,
            name: input.primaryContact.name,
            role: input.primaryContact.role ?? null,
            email: input.primaryContact.email ?? null,
            phone: input.primaryContact.phone ?? null,
            is_primary: true,
            created_at: now,
            updated_at: now,
          });
        }
      });
    } catch (error) {
      if (isUniqueConstraintError(error, 'clients.name')) {
        throw new ConflictException('Un client porte déjà ce nom.');
      }
      throw error;
    }

    return this.findOne(clientId);
  }

  async update(clientId: string, input: UpdateClientDto): Promise<ClientView> {
    const current = await this.selectClient(clientId);
    if (!current) throw new NotFoundException('Client introuvable.');
    const now = new Date().toISOString();

    try {
      await this.database.connection.transaction(async (transaction) => {
        await transaction('clients')
          .where({ id: clientId })
          .update({
            name: input.name ?? current.name,
            kind: input.kind ?? current.kind,
            status: input.status ?? current.status,
            email: input.email === undefined ? current.email : input.email,
            phone: input.phone === undefined ? current.phone : input.phone,
            website:
              input.website === undefined ? current.website : input.website,
            notes: input.notes === undefined ? current.notes : input.notes,
            logo_data_url:
              input.logoDataUrl === undefined
                ? current.logo_data_url
                : input.logoDataUrl,
            updated_at: now,
          });

        if (input.primaryContact === undefined) return;

        const primaryContact = await transaction<{ id: string }>(
          'client_contacts',
        )
          .select('id')
          .where('client_id', clientId)
          .andWhere('is_primary', true)
          .first();

        if (input.primaryContact === null) {
          await transaction('client_contacts')
            .where({ client_id: clientId, is_primary: true })
            .delete();
        } else if (primaryContact) {
          await transaction('client_contacts')
            .where({ id: primaryContact.id })
            .update({
              name: input.primaryContact.name,
              role: input.primaryContact.role ?? null,
              email: input.primaryContact.email ?? null,
              phone: input.primaryContact.phone ?? null,
              updated_at: now,
            });
        } else {
          await transaction('client_contacts').insert({
            id: randomUUID(),
            client_id: clientId,
            name: input.primaryContact.name,
            role: input.primaryContact.role ?? null,
            email: input.primaryContact.email ?? null,
            phone: input.primaryContact.phone ?? null,
            is_primary: true,
            created_at: now,
            updated_at: now,
          });
        }
      });
    } catch (error) {
      if (isUniqueConstraintError(error, 'clients.name')) {
        throw new ConflictException('Un client porte déjà ce nom.');
      }
      throw error;
    }

    return this.findOne(clientId);
  }

  async findAll(): Promise<ClientView[]> {
    const clients = await this.selectClients();
    return Promise.all(clients.map((client) => this.toClientView(client)));
  }

  async findOne(clientId: string): Promise<ClientView> {
    const client = await this.selectClient(clientId);
    if (!client) throw new NotFoundException('Client introuvable.');
    return this.toClientView(client);
  }

  private selectClients(): Promise<ClientRow[]> {
    return this.database
      .connection<ClientRow>('clients')
      .select('*')
      .orderBy('updated_at', 'desc')
      .orderBy('name', 'asc');
  }

  private selectClient(clientId: string): Promise<ClientRow | undefined> {
    return this.database
      .connection<ClientRow>('clients')
      .select('*')
      .where({ id: clientId })
      .first();
  }

  private async selectContacts(clientId: string): Promise<ClientContactView[]> {
    const contacts = await this.database
      .connection<ClientContactRow>('client_contacts')
      .select('*')
      .where('client_id', clientId)
      .orderBy('is_primary', 'desc')
      .orderBy('name', 'asc');

    return contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      role: contact.role,
      email: contact.email,
      phone: contact.phone,
      isPrimary: contact.is_primary === true || contact.is_primary === 1,
      createdAt: contact.created_at,
      updatedAt: contact.updated_at,
    }));
  }

  private async selectProjects(clientId: string): Promise<ClientProjectView[]> {
    const projects = (await this.database
      .connection('projects')
      .leftJoin('repositories', 'repositories.project_id', 'projects.id')
      .select(
        'projects.id',
        'projects.name',
        'projects.created_at',
        'projects.updated_at',
      )
      .count({ repositories_count: 'repositories.id' })
      .where('projects.client_id', clientId)
      .groupBy(
        'projects.id',
        'projects.name',
        'projects.created_at',
        'projects.updated_at',
      )
      .orderBy('projects.updated_at', 'desc')) as ClientProjectRow[];

    return projects.map((project) => ({
      id: project.id,
      name: project.name,
      repositoriesCount: Number(project.repositories_count),
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    }));
  }

  private async toClientView(client: ClientRow): Promise<ClientView> {
    const [contacts, projects] = await Promise.all([
      this.selectContacts(client.id),
      this.selectProjects(client.id),
    ]);

    return {
      id: client.id,
      name: client.name,
      kind: client.kind,
      status: client.status,
      email: client.email,
      phone: client.phone,
      website: client.website,
      notes: client.notes,
      logoDataUrl: client.logo_data_url,
      projectsCount: projects.length,
      repositoriesCount: projects.reduce(
        (count, project) => count + project.repositoriesCount,
        0,
      ),
      contacts,
      projects,
      createdAt: client.created_at,
      updatedAt: client.updated_at,
    };
  }
}
