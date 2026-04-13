import { PageHeader } from "@/components/layout/PageHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAiModels,
  useCreateAiModel,
  useDeleteAiModel,
  useMasterAiModels,
  useUpdateAiModel,
} from "@/hooks/useAiModels";
import { ROUTES } from "@/lib/constants";
import type { AiModel, AiProvider } from "@/types/ai-model";
import { zodResolver } from "@hookform/resolvers/zod";
import { Brain, ExternalLink, Eye, EyeOff, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

// ─── Create / Edit dialog ──────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  model_id: z.string().min(1, "Model is required"),
  api_key: z.string().min(10, "API key is required"),
  base_url: z.string().optional(),
});
type CreateForm = z.infer<typeof createSchema>;

const editSchema = z.object({
  name: z.string().min(1, "Name is required"),
  model_id: z.string().min(1, "Model is required"),
  api_key: z.string().optional(),
  base_url: z.string().optional(),
});
type EditForm = z.infer<typeof editSchema>;

// ─── OpenRouter OAuth form ──────────────────────────────────────────────────

const orSchema = z.object({
  name: z.string().min(1, "Label is required"),
  model_id: z.string().min(1, "Model is required"),
});
type OrForm = z.infer<typeof orSchema>;

function OpenRouterForm({ onCancel }: { onCancel: () => void }) {
  const { data: models = [] } = useMasterAiModels("openrouter");
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<OrForm>({ resolver: zodResolver(orSchema) });

  const onSubmit = (values: OrForm) => {
    sessionStorage.setItem("openrouter_pending", JSON.stringify(values));
    const callbackUrl = `${window.location.origin}${ROUTES.OPENROUTER_CALLBACK}`;
    window.location.assign(
      `https://openrouter.ai/auth?callback_url=${encodeURIComponent(callbackUrl)}`,
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="rounded-md bg-muted/50 border px-3 py-2.5 text-xs text-muted-foreground leading-relaxed">
        You'll be redirected to <span className="font-medium text-foreground">OpenRouter</span> to
        authorize access. No API key needed — the key is generated automatically via OAuth.
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Label</Label>
        <Input placeholder="e.g. My OpenRouter GPT-4o" {...register("name")} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Model</Label>
        <Controller
          control={control}
          name="model_id"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value ?? ""}>
              <SelectTrigger>
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="font-medium">{m.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {(m.context_window / 1000).toFixed(0)}k ctx
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.model_id && <p className="text-xs text-destructive">{errors.model_id.message}</p>}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
          Authorize via OpenRouter
        </Button>
      </DialogFooter>
    </form>
  );
}

// ─── Create dialog ──────────────────────────────────────────────────────────

function CreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateAiModel();
  const [showKey, setShowKey] = useState(false);
  const [provider, setProvider] = useState<AiProvider>("openai");
  const { data: masterModels = [] } = useMasterAiModels(
    provider === "openrouter" ? "openrouter" : provider,
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CreateForm>({ resolver: zodResolver(createSchema) });

  const handleClose = () => {
    reset();
    setProvider("openai");
    onClose();
  };

  const onSubmit = async (values: CreateForm) => {
    await create.mutateAsync({ ...values, provider });
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add AI Model</DialogTitle>
          <DialogDescription>Configure an AI model for your bots.</DialogDescription>
        </DialogHeader>

        {/* Provider selector */}
        <div className="flex rounded-lg border overflow-hidden text-sm">
          {(["openai", "gemini", "anthropic", "openrouter", "claude_code"] as AiProvider[]).map(
            (p) => (
              <button
                key={p}
                type="button"
                className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                  provider === p
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
                onClick={() => {
                  setProvider(p);
                  reset();
                }}
              >
                {PROVIDER_LABEL[p]}
              </button>
            ),
          )}
        </div>

        {provider === "openrouter" ? (
          <OpenRouterForm onCancel={handleClose} />
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Label</Label>
              <Input
                placeholder={
                  provider === "gemini"
                    ? "e.g. Gemini 2.0 Flash"
                    : provider === "anthropic"
                      ? "e.g. Claude 3.7 Sonnet"
                      : provider === "claude_code"
                        ? "e.g. Claude Code (Sonnet 3.7)"
                        : "e.g. Production GPT-4o"
                }
                {...register("name")}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Model</Label>
              <Controller
                control={control}
                name="model_id"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {masterModels.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          <span className="font-medium">{m.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {(m.context_window / 1000).toFixed(0)}k ctx
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.model_id && (
                <p className="text-xs text-destructive">{errors.model_id.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>
                API Key
                {provider === "gemini" && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    — aistudio.google.com
                  </span>
                )}
                {provider === "anthropic" && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    — console.anthropic.com
                  </span>
                )}
                {provider === "claude_code" && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    — Claude Code session token
                  </span>
                )}
              </Label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  placeholder={
                    provider === "gemini"
                      ? "AIzaSy..."
                      : provider === "anthropic"
                        ? "sk-ant-..."
                        : provider === "claude_code"
                          ? "sk-ant-sid-..."
                          : "sk-..."
                  }
                  {...register("api_key")}
                  className="pr-10"
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowKey((v) => !v)}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.api_key && (
                <p className="text-xs text-destructive">{errors.api_key.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>
                Custom Base URL
                <span className="ml-2 text-xs font-normal text-muted-foreground">— Optional</span>
              </Label>
              <Input
                placeholder={
                  provider === "claude_code"
                    ? "e.g. http://38.147.122.69:3001"
                    : "e.g. https://api.yourproxy.com/v1"
                }
                {...register("base_url")}
                autoComplete="off"
              />
            </div>

            {create.error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {(create.error as Error).message}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Adding..." : "Add Model"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  model,
  open,
  onClose,
}: {
  model: AiModel;
  open: boolean;
  onClose: () => void;
}) {
  const update = useUpdateAiModel();
  const [showKey, setShowKey] = useState(false);
  const [provider, setProvider] = useState<AiProvider>(model.provider);
  const { data: masterModels = [] } = useMasterAiModels(provider);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: model.name, model_id: model.model_id, base_url: model.base_url || "" },
  });

  const handleProviderChange = (p: AiProvider) => {
    setProvider(p);
    setValue("model_id", "");
  };

  const onSubmit = async (values: EditForm) => {
    await update.mutateAsync({
      id: model.id,
      body: {
        name: values.name,
        model_id: values.model_id,
        provider,
        base_url: values.base_url,
        ...(values.api_key ? { api_key: values.api_key } : {}),
      },
    });
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && (reset(), onClose())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit AI Model</DialogTitle>
          <DialogDescription>Leave API key blank to keep the current key.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {/* Provider selector */}
          <div className="flex rounded-lg border overflow-hidden text-sm">
            {(["openai", "gemini", "anthropic", "openrouter", "claude_code"] as AiProvider[]).map(
              (p) => (
                <button
                  key={p}
                  type="button"
                  className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                    provider === p
                      ? "bg-primary text-primary-foreground"
                      : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                  onClick={() => handleProviderChange(p)}
                >
                  {PROVIDER_LABEL[p]}
                </button>
              ),
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Label</Label>
            <Input {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Model</Label>
            <Controller
              control={control}
              name="model_id"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {masterModels.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="font-medium">{m.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {(m.context_window / 1000).toFixed(0)}k ctx
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.model_id && (
              <p className="text-xs text-destructive">{errors.model_id.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>
              New API Key{" "}
              <span className="text-xs text-muted-foreground font-normal">
                (current: {model.api_key_hint}){provider === "gemini" && " — aistudio.google.com"}
                {provider === "anthropic" && " — console.anthropic.com"}
                {provider === "claude_code" && " — Claude Code Token"}
              </span>
            </Label>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                placeholder="Leave blank to keep current"
                {...register("api_key")}
                className="pr-10"
                autoComplete="off"
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowKey((v) => !v)}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>
              Custom Base URL
              <span className="ml-2 text-xs font-normal text-muted-foreground">— Optional</span>
            </Label>
            <Input
              placeholder="e.g. https://api.yourproxy.com/v1"
              {...register("base_url")}
              autoComplete="off"
            />
          </div>

          {update.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {(update.error as Error).message}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => (reset(), onClose())}>
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────

const PROVIDER_LABEL: Record<string, string> = {
  openai: "OpenAI",
  openrouter: "OpenRouter",
  gemini: "Gemini",
  anthropic: "Anthropic",
  claude_code: "Claude Code",
};

export function AiModelsPage() {
  const { data: models = [], isLoading } = useAiModels();
  const deleteModel = useDeleteAiModel();

  const [createOpen, setCreateOpen] = useState(false);
  const [editModel, setEditModel] = useState<AiModel | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        title="AI Models"
        description="Configure AI model credentials for your bots"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Model
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : models.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <div className="mb-3 rounded-full bg-muted p-3">
            <Brain className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium">No AI models configured</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add an OpenAI model with an API key, or connect via OpenRouter OAuth
          </p>
          <Button className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Model
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Label</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Model</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Provider</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">API Key</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {models.map((model) => (
                <tr key={model.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{model.name}</td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{model.model_id}</code>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">
                      {PROVIDER_LABEL[model.provider] ?? model.provider}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {model.api_key_hint}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditModel(model)}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteId(model.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      {editModel && (
        <EditDialog model={editModel} open={!!editModel} onClose={() => setEditModel(null)} />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete AI Model</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the model configuration. Clients using this model will lose their AI
              connection until reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deleteId) {
                  await deleteModel.mutateAsync(deleteId);
                  setDeleteId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
