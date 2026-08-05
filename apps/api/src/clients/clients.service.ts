import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { isUniqueConstraintError } from '../database/sqlite-error';
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
  projects_count: number;
  repositories_count: number;
  created_at: string;
  updated_at: string;
}

interface ClientContactRow {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  is_primary: number;
  created_at: string;
  updated_at: string;
}

interface ClientProjectRow {
  id: string;
  name: string;
  repositories_count: number;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class ClientsService {
  constructor(private readonly database: DatabaseService) {}

  create(input: CreateClientDto): ClientView {
    const clientId = randomUUID();
    const now = new Date().toISOString();

    try {
      this.database.connection.transaction(() => {
        this.database.connection
          .prepare(
            `INSERT INTO clients (
               id, name, kind, status, email, phone, website, notes,
               logo_data_url, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            clientId,
            input.name,
            input.kind,
            input.status,
            input.email ?? null,
            input.phone ?? null,
            input.website ?? null,
            input.notes ?? null,
            input.logoDataUrl ?? null,
            now,
            now,
          );

        if (input.primaryContact) {
          this.database.connection
            .prepare(
              `INSERT INTO client_contacts (
                 id, client_id, name, role, email, phone, is_primary,
                 created_at, updated_at
               ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
            )
            .run(
              randomUUID(),
              clientId,
              input.primaryContact.name,
              input.primaryContact.role ?? null,
              input.primaryContact.email ?? null,
              input.primaryContact.phone ?? null,
              now,
              now,
            );
        }
      })();
    } catch (error) {
      if (isUniqueConstraintError(error, 'clients.name')) {
        throw new ConflictException('Un client porte déjà ce nom.');
      }

      throw error;
    }

    return this.findOne(clientId);
  }

  update(clientId: string, input: UpdateClientDto): ClientView {
    const current = this.selectClient(clientId);

    if (!current) {
      throw new NotFoundException('Client introuvable.');
    }

    const now = new Date().toISOString();

    try {
      this.database.connection.transaction(() => {
        this.database.connection
          .prepare(
            `UPDATE clients
             SET name = ?, kind = ?, status = ?, email = ?, phone = ?,
                 website = ?, notes = ?, logo_data_url = ?, updated_at = ?
             WHERE id = ?`,
          )
          .run(
            input.name ?? current.name,
            input.kind ?? current.kind,
            input.status ?? current.status,
            input.email === undefined ? current.email : input.email,
            input.phone === undefined ? current.phone : input.phone,
            input.website === undefined ? current.website : input.website,
            input.notes === undefined ? current.notes : input.notes,
            input.logoDataUrl === undefined
              ? current.logo_data_url
              : input.logoDataUrl,
            now,
            clientId,
          );

        if (input.primaryContact !== undefined) {
          const primaryContact = this.database.connection
            .prepare(
              `SELECT id
               FROM client_contacts
               WHERE client_id = ? AND is_primary = 1
               LIMIT 1`,
            )
            .get(clientId) as { id: string } | undefined;

          if (input.primaryContact === null) {
            this.database.connection
              .prepare(
                `DELETE FROM client_contacts
                 WHERE client_id = ? AND is_primary = 1`,
              )
              .run(clientId);
          } else if (primaryContact) {
            this.database.connection
              .prepare(
                `UPDATE client_contacts
                 SET name = ?, role = ?, email = ?, phone = ?, updated_at = ?
                 WHERE id = ?`,
              )
              .run(
                input.primaryContact.name,
                input.primaryContact.role ?? null,
                input.primaryContact.email ?? null,
                input.primaryContact.phone ?? null,
                now,
                primaryContact.id,
              );
          } else {
            this.database.connection
              .prepare(
                `INSERT INTO client_contacts (
                   id, client_id, name, role, email, phone, is_primary,
                   created_at, updated_at
                 ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
              )
              .run(
                randomUUID(),
                clientId,
                input.primaryContact.name,
                input.primaryContact.role ?? null,
                input.primaryContact.email ?? null,
                input.primaryContact.phone ?? null,
                now,
                now,
              );
          }
        }
      })();
    } catch (error) {
      if (isUniqueConstraintError(error, 'clients.name')) {
        throw new ConflictException('Un client porte déjà ce nom.');
      }

      throw error;
    }

    return this.findOne(clientId);
  }

  findAll(): ClientView[] {
    return this.selectClients().map((client) => this.toClientView(client));
  }

  findOne(clientId: string): ClientView {
    const client = this.selectClient(clientId);

    if (!client) {
      throw new NotFoundException('Client introuvable.');
    }

    return this.toClientView(client);
  }

  private selectClients(): ClientRow[] {
    return this.database.connection
      .prepare(
        `SELECT
           clients.id,
           clients.name,
           clients.kind,
           clients.status,
           clients.email,
           clients.phone,
           clients.website,
           clients.notes,
           clients.logo_data_url,
           (SELECT COUNT(*) FROM projects WHERE projects.client_id = clients.id)
             AS projects_count,
           (
             SELECT COUNT(*)
             FROM repositories
             INNER JOIN projects ON projects.id = repositories.project_id
             WHERE projects.client_id = clients.id
           ) AS repositories_count,
           clients.created_at,
           clients.updated_at
         FROM clients
         ORDER BY clients.updated_at DESC, clients.name ASC`,
      )
      .all() as ClientRow[];
  }

  private selectClient(clientId: string): ClientRow | undefined {
    return this.database.connection
      .prepare(
        `SELECT
           clients.id,
           clients.name,
           clients.kind,
           clients.status,
           clients.email,
           clients.phone,
           clients.website,
           clients.notes,
           clients.logo_data_url,
           (SELECT COUNT(*) FROM projects WHERE projects.client_id = clients.id)
             AS projects_count,
           (
             SELECT COUNT(*)
             FROM repositories
             INNER JOIN projects ON projects.id = repositories.project_id
             WHERE projects.client_id = clients.id
           ) AS repositories_count,
           clients.created_at,
           clients.updated_at
         FROM clients
         WHERE clients.id = ?`,
      )
      .get(clientId) as ClientRow | undefined;
  }

  private selectContacts(clientId: string): ClientContactView[] {
    const contacts = this.database.connection
      .prepare(
        `SELECT
           id, name, role, email, phone, is_primary, created_at, updated_at
         FROM client_contacts
         WHERE client_id = ?
         ORDER BY is_primary DESC, name ASC`,
      )
      .all(clientId) as ClientContactRow[];

    return contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      role: contact.role,
      email: contact.email,
      phone: contact.phone,
      isPrimary: contact.is_primary === 1,
      createdAt: contact.created_at,
      updatedAt: contact.updated_at,
    }));
  }

  private selectProjects(clientId: string): ClientProjectView[] {
    const projects = this.database.connection
      .prepare(
        `SELECT
           projects.id,
           projects.name,
           COUNT(repositories.id) AS repositories_count,
           projects.created_at,
           projects.updated_at
         FROM projects
         LEFT JOIN repositories ON repositories.project_id = projects.id
         WHERE projects.client_id = ?
         GROUP BY projects.id
         ORDER BY projects.updated_at DESC`,
      )
      .all(clientId) as ClientProjectRow[];

    return projects.map((project) => ({
      id: project.id,
      name: project.name,
      repositoriesCount: project.repositories_count,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    }));
  }

  private toClientView(client: ClientRow): ClientView {
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
      projectsCount: client.projects_count,
      repositoriesCount: client.repositories_count,
      contacts: this.selectContacts(client.id),
      projects: this.selectProjects(client.id),
      createdAt: client.created_at,
      updatedAt: client.updated_at,
    };
  }
}
