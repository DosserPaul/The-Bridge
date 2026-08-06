"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock3, Euro, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createProjectTimeEntry,
  deleteProjectTimeEntry,
  getProjectCommercial,
  updateProjectFinance,
  type ProjectCommercial,
} from "@/lib/api";

function money(cents: number | null, currency: string) {
  return cents == null
    ? "—"
    : new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(
        cents / 100,
      );
}

export function ProjectCommercialPanel({ projectId }: { projectId: string }) {
  const [data, setData] = useState<ProjectCommercial | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setData(await getProjectCommercial(projectId));
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Chargement impossible.",
      );
    }
  }, [projectId]);
  useEffect(() => {
    const controller = new AbortController();
    void getProjectCommercial(projectId, controller.signal)
      .then((result) => setData(result))
      .catch((caught: unknown) => {
        if (!controller.signal.aborted)
          setError(
            caught instanceof Error ? caught.message : "Chargement impossible.",
          );
      });
    return () => controller.abort();
  }, [projectId]);

  if (!data)
    return (
      <p className="text-xs text-muted-foreground">{error ?? "Chargement…"}</p>
    );
  const finance = data.finance;
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-base font-semibold">
            Temps & budget
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Suivi facturable, budget consommé et prochaine facturation.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setEditing((value) => !value)}
        >
          <Euro /> Paramètres
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [
            "Temps total",
            `${Math.floor(finance.totalMinutes / 60)} h ${finance.totalMinutes % 60} min`,
          ],
          [
            "Valeur facturable",
            money(finance.billableValueCents, finance.currency),
          ],
          [
            "Budget restant",
            money(finance.remainingBudgetCents, finance.currency),
          ],
          [
            "Consommé",
            finance.budgetConsumedPercent == null
              ? "—"
              : `${finance.budgetConsumedPercent} %`,
          ],
        ].map(([label, value]) => (
          <Card key={label} size="sm">
            <CardContent className="pt-4">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                {label}
              </p>
              <p className="mt-2 font-heading text-xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {editing ? (
        <Card size="sm">
          <CardContent className="pt-4">
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void updateProjectFinance(projectId, {
                  dailyRateCents: form.get("rate")
                    ? Math.round(Number(form.get("rate")) * 100)
                    : null,
                  budgetCents: form.get("budget")
                    ? Math.round(Number(form.get("budget")) * 100)
                    : null,
                  currency: String(form.get("currency")),
                  nextInvoiceDate: String(form.get("invoice")) || null,
                })
                  .then((updated) => {
                    setData(updated);
                    setEditing(false);
                  })
                  .catch((caught: unknown) =>
                    setError(
                      caught instanceof Error
                        ? caught.message
                        : "Enregistrement impossible.",
                    ),
                  );
              }}
            >
              <Input
                name="rate"
                type="number"
                min="0"
                step="0.01"
                defaultValue={
                  finance.dailyRateCents == null
                    ? ""
                    : finance.dailyRateCents / 100
                }
                placeholder="TJM"
              />
              <Input
                name="budget"
                type="number"
                min="0"
                step="0.01"
                defaultValue={
                  finance.budgetCents == null ? "" : finance.budgetCents / 100
                }
                placeholder="Budget"
              />
              <Input
                name="currency"
                defaultValue={finance.currency}
                maxLength={3}
              />
              <Input
                name="invoice"
                type="date"
                defaultValue={finance.nextInvoiceDate ?? ""}
              />
              <div className="sm:col-span-2 flex justify-end">
                <Button size="sm" type="submit">
                  Enregistrer
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
      <Card size="sm">
        <CardHeader className="border-b">
          <CardTitle>Saisies de temps</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <form
            className="grid gap-3 border-b p-4 sm:grid-cols-[150px_110px_minmax(0,1fr)_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void createProjectTimeEntry(projectId, {
                date: String(form.get("date")),
                durationMinutes: Number(form.get("minutes")),
                description: String(form.get("description")),
                billable: form.get("billable") === "on",
              })
                .then((updated) => {
                  setData(updated);
                  event.currentTarget.reset();
                })
                .catch((caught: unknown) =>
                  setError(
                    caught instanceof Error
                      ? caught.message
                      : "Ajout impossible.",
                  ),
                );
            }}
          >
            <Input
              name="date"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
            <Input
              name="minutes"
              type="number"
              min="1"
              max="1440"
              required
              placeholder="Minutes"
            />
            <Input
              name="description"
              required
              minLength={2}
              placeholder="Travail réalisé"
            />
            <div className="flex items-center gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <input name="billable" type="checkbox" defaultChecked />{" "}
                Facturable
              </label>
              <Button type="submit" size="icon-sm" aria-label="Ajouter">
                <Plus />
              </Button>
            </div>
          </form>
          <div className="divide-y">
            {data.entries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 p-4">
                <Clock3 className="size-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">
                    {entry.description}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {entry.date} · {entry.durationMinutes} min
                  </p>
                </div>
                <Badge variant="outline">
                  {entry.billable ? "Facturable" : "Interne"}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Supprimer"
                  onClick={() =>
                    void deleteProjectTimeEntry(projectId, entry.id).then(load)
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            {!data.entries.length ? (
              <p className="p-8 text-center text-xs text-muted-foreground">
                Aucune saisie.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
