"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateIssueData, UpdateIssueData, PriorityLevel } from "@/lib/types";
import { Project, WorkflowState, Label as LabelType } from "@prisma/client";
import { UserSelector } from "@/components/shared/user-selector";
import { UserAvatar } from "@/components/shared/user-avatar";
import { PriorityIcon } from "@/components/shared/priority-icon";
import {
  Circle,
  MoreHorizontal,
  User,
  Settings,
  Tag,
  MoreVertical,
  X,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ISSUE_ACTION } from "@/app/[locale]/dashboard/[teamId]/issues/page";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { translateWorkflowState } from "@/lib/i18n/translate-workflow-state";
import { translateLabel } from "@/lib/i18n/translate-label";

// Create schema function that accepts translation function
const createIssueSchema = (t: any) => z.object({
  title: z.string().min(1, t('validation.titleRequired')).max(255, t('validation.titleTooLong')),
  description: z.string().optional(),
  projectId: z.string().optional(),
  workflowStateId: z.string().min(1, t('validation.statusRequired')),
  assigneeId: z.string().optional(),
  priority: z.enum(["none", "low", "medium", "high", "urgent"]).optional(),
  estimate: z.number().min(0).optional(),
  labelIds: z.array(z.string()).optional(),
});

type IssueFormData = {
  title: string;
  description?: string;
  projectId?: string;
  workflowStateId: string;
  assigneeId?: string;
  priority?: "none" | "low" | "medium" | "high" | "urgent";
  estimate?: number;
  labelIds?: string[];
};

interface IssueDialogProps {
  action: ISSUE_ACTION;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateIssueData | UpdateIssueData) => Promise<void>;
  projects: Project[];
  workflowStates: WorkflowState[];
  labels: LabelType[];
  initialData?: Partial<IssueFormData>;
  title?: string;
  description?: string;
  teamId?: string;
  teamName?: string;
}

export function IssueDialog({
  open,
  onOpenChange,
  onSubmit,
  projects,
  workflowStates,
  labels,
  initialData,
  description = "Create a new issue for your team.",
  teamId,
  teamName,
  action,
}: IssueDialogProps) {
  const t = useTranslations('components.issueDialog');
  const tCommon = useTranslations();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<string[]>(
    initialData?.labelIds || [],
  );
  const [createMore, setCreateMore] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);

  const form = useForm<IssueFormData>({
    resolver: zodResolver(createIssueSchema(t)),
    mode: "onChange",
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || "",
      projectId: initialData?.projectId || "",
      workflowStateId:
        initialData?.workflowStateId ||
        (workflowStates.length > 0 ? workflowStates[0].id : ""),
      assigneeId: initialData?.assigneeId || "",
      priority: initialData?.priority || "none",
      estimate: initialData?.estimate,
      labelIds: initialData?.labelIds || [],
    },
  });

  const formReset: IssueFormData = useMemo(() => ({
    title: "",
    description: "",
    projectId: "",
    workflowStateId: workflowStates.length > 0 ? workflowStates[0].id : "",
    assigneeId: "",
    priority: "none",
    estimate: undefined,
    labelIds: [],
  }), [workflowStates]);

  useEffect(() => {
    if (open && initialData && !isSubmitting && !createMore) {
      const resetData = {
        ...initialData,
        title: initialData.title || "",
        projectId: initialData.projectId || "",
        workflowStateId:
          initialData.workflowStateId ||
          (workflowStates.length > 0 ? workflowStates[0].id : ""),
        assigneeId: initialData.assigneeId || "",
        priority: initialData.priority || "none",
        labelIds: initialData.labelIds || [],
      };
      form.reset(resetData);
      setSelectedLabels(initialData.labelIds || []);
      // Trigger validation to ensure form is valid
      setTimeout(() => {
        form.trigger();
      }, 0);
    } else if (open && !isSubmitting) {
      // To prevent On update re render
      // Check if we're creating from a board column
      const storedWorkflowStateId =
        typeof window !== "undefined"
          ? sessionStorage.getItem("createIssueWorkflowStateId")
          : null;

      const defaultWorkflowStateId =
        storedWorkflowStateId ||
        (workflowStates.length > 0 ? workflowStates[0].id : "");

      if (storedWorkflowStateId && typeof window !== "undefined") {
        sessionStorage.removeItem("createIssueWorkflowStateId");
      }

      form.reset({ ...formReset, workflowStateId: defaultWorkflowStateId });
      setSelectedLabels([]);
    }
  }, [isSubmitting, open, initialData, form, workflowStates, createMore, formReset]);

  useEffect(() => {
    if (workflowStates.length > 0) {
      const currentWorkflowStateId = form.getValues("workflowStateId");
      // If no workflow state is set, or if the current one is invalid, set default
      if (
        !currentWorkflowStateId ||
        !workflowStates.find((s) => s.id === currentWorkflowStateId)
      ) {
        form.setValue("workflowStateId", workflowStates[0].id);
      }
    }
  }, [workflowStates, form]);

  const handleSubmit = async (data: IssueFormData) => {
    setIsSubmitting(true);
    try {
      // Prepare the submission data
      // For updates, send all fields (even if empty) so the backend can properly normalize them
      // For creates, optional fields that are empty can be undefined
      const isUpdate = !!initialData;

      if (action === ISSUE_ACTION.CREATE) {
        const result = createIssueSchema(t).safeParse(data);

        if (!result.success) {
          toast.error(result.error.issues[0].message || t('validation.validationFailed'));
          form.setFocus("title");
          return;
        }
        const submitData: CreateIssueData = {
          title: data.title,
          description: data.description || undefined,
          workflowStateId: data.workflowStateId,
          projectId:
            data.projectId && data.projectId.trim() !== ""
              ? data.projectId
              : undefined,
          assigneeId:
            data.assigneeId && data.assigneeId.trim() !== ""
              ? data.assigneeId
              : undefined,
          priority: data.priority || "none",
          estimate: data.estimate,
          labelIds: selectedLabels,
        };
        await onSubmit(submitData);
      } else if (isUpdate) {
        // Make improments for Assign and Move
        const isTrue = data.title.trim() === "";

        if (isTrue) {
          toast.error(t('validation.titleRequired'));
          form.setFocus("title");
          return;
        }

        const submitData: UpdateIssueData = {
          title: data.title,
          description:
            data.description === "" ? null : data.description || undefined,
          workflowStateId: data.workflowStateId,
          projectId:
            data.projectId && data.projectId.trim() !== ""
              ? data.projectId
              : null,
          assigneeId:
            data.assigneeId && data.assigneeId.trim() !== ""
              ? data.assigneeId
              : null,
          priority: data.priority || "none",
          estimate: data.estimate,
          labelIds: selectedLabels,
        };
        await onSubmit(submitData);
      }

      form.reset(formReset);
      setSelectedLabels([]);
      if (createMore && action === ISSUE_ACTION.CREATE) {
        form.setFocus("title");
      } else {
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Error submitting issue:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleLabel = (labelId: string) => {
    setSelectedLabels((prev) =>
      prev.includes(labelId)
        ? prev.filter((id) => id !== labelId)
        : [...prev, labelId],
    );
  };

  const currentStatus = workflowStates.find(
    (s) => s.id === form.watch("workflowStateId"),
  );
  const currentPriority = form.watch("priority") as PriorityLevel;
  const currentAssigneeId = form.watch("assigneeId");
  const currentProjectId = form.watch("projectId");
  const currentProject = projects.find((p) => p.id === currentProjectId);
  const selectedLabelsData = labels.filter((l) =>
    selectedLabels.includes(l.id),
  );

  // Get assignee name from team members
  const [assigneeName, setAssigneeName] = useState<string>("");

  useEffect(() => {
    if (currentAssigneeId && teamId) {
      fetch(`/api/teams/${teamId}/members`)
        .then((res) => res.json())
        .then((members) => {
          const member = members.find(
            (m: any) => m.userId === currentAssigneeId,
          );
          setAssigneeName(member?.userName || "");
        })
        .catch(() => setAssigneeName(""));
    } else {
      setAssigneeName("");
    }
  }, [currentAssigneeId, teamId]);

  const getStatusIcon = (stateType: string) => {
    switch (stateType) {
      case "backlog":
        return <MoreHorizontal className="h-4 w-4" />;
      case "unstarted":
        return (
          <Circle
            className="h-4 w-4"
            style={{ fill: "none", strokeWidth: 2 }}
          />
        );
      case "started":
        return (
          <Circle
            className="h-4 w-4"
            style={{ fill: "none", strokeWidth: 2 }}
          />
        );
      case "completed":
        return (
          <div className="h-4 w-4 rounded-full border-2 flex items-center justify-center">
            <Check className="h-2.5 w-2.5" />
          </div>
        );
      default:
        return (
          <Circle
            className="h-4 w-4"
            style={{ fill: "none", strokeWidth: 2 }}
          />
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[700px] p-0 gap-0 [&>button]:hidden"
        onEscapeKeyDown={() => {
          form.reset(formReset);
        }}
        onInteractOutside={() => {
          form.reset(formReset);
        }}
      >
        {/* Custom Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              {action === ISSUE_ACTION.EDIT ? t('editIssue') : t('newIssue')}
            </span>

            {/* Action Icons */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => {
                  onOpenChange(false);
                  form.reset(formReset);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-col h-full"
          >
            <div className="flex-1 px-6 py-4 space-y-4">
              {/* Title Input */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        placeholder={t('placeholders.title')}
                        className="text-lg font-medium border-0 px-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-auto py-2"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description Input */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder={t('placeholders.description')}
                        className="border-0 px-0 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none min-h-[100px] text-muted-foreground"
                        {...field}
                        onKeyDown={async (e) => {
                          if (e.key == "Enter" && (e.ctrlKey || e.metaKey)) {
                            const data = form.getValues();
                            await handleSubmit(data);
                          }
                          if (e.key == "Escape") {
                            // Prevent the data to be store .... or even give an alert as per design pattern
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Property Buttons Row */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Project Button */}
                <DropdownMenu open={projectOpen} onOpenChange={setProjectOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-8 px-3 font-mono text-sm border rounded-md transition-colors",
                        currentProject
                          ? "bg-background border-border hover:bg-muted"
                          : "bg-muted/50 border-border/50 hover:bg-muted",
                      )}
                    >
                      {currentProject ? (
                        <span className="text-foreground font-medium">
                          {currentProject.key}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          {t('noProject')}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64">
                    <DropdownMenuItem
                      onClick={() => {
                        form.setValue("projectId", "");
                        setProjectOpen(false);
                      }}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="text-muted-foreground">{t('noProject')}</span>
                      {!currentProjectId && (
                        <Check className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                    </DropdownMenuItem>
                    {projects.map((project) => (
                      <DropdownMenuItem
                        key={project.id}
                        onClick={() => {
                          form.setValue("projectId", project.id);
                          setProjectOpen(false);
                        }}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div
                            className="h-3 w-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: project.color }}
                          />
                          <span className="font-mono text-sm flex-shrink-0">
                            {project.key}
                          </span>
                          <span className="text-sm text-muted-foreground truncate">
                            {project.name}
                          </span>
                        </div>
                        {currentProjectId === project.id && (
                          <Check className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Status Button */}
                <DropdownMenu open={statusOpen} onOpenChange={setStatusOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 gap-2"
                    >
                      {currentStatus && getStatusIcon(currentStatus.type)}
                      <span>{currentStatus ? translateWorkflowState(currentStatus.name, tCommon) : t('defaultStatus')}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    {workflowStates.map((state) => (
                      <DropdownMenuItem
                        key={state.id}
                        onClick={() => {
                          form.setValue("workflowStateId", state.id);
                          setStatusOpen(false);
                        }}
                        className="flex items-center gap-2"
                      >
                        {getStatusIcon(state.type)}
                        <span className="flex-1">{translateWorkflowState(state.name, tCommon)}</span>
                        {form.watch("workflowStateId") === state.id && (
                          <Check className="h-4 w-4 text-muted-foreground" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Priority Button */}
                <DropdownMenu
                  open={priorityOpen}
                  onOpenChange={setPriorityOpen}
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 gap-2"
                    >
                      <PriorityIcon priority={currentPriority} />
                      <span>
                        {currentPriority === "none"
                          ? t('priority')
                          : t(`priorities.${currentPriority}`)}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    {(["none", "low", "medium", "high", "urgent"] as const).map((priority) => (
                      <DropdownMenuItem
                        key={priority}
                        onClick={() => {
                          form.setValue("priority", priority);
                          setPriorityOpen(false);
                        }}
                        className="flex items-center gap-2"
                      >
                        <PriorityIcon priority={priority} />
                        <span className="flex-1">{t(`priorities.${priority}`)}</span>
                        {currentPriority === priority && (
                          <Check className="h-4 w-4 text-muted-foreground" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Assignee Button */}
                <DropdownMenu
                  open={assigneeOpen}
                  onOpenChange={setAssigneeOpen}
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 gap-2 relative"
                    >
                      <User className="h-4 w-4" />
                      <span>{assigneeName || t('assignee')}</span>
                      <Settings className="h-3 w-3 absolute -top-1 -right-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64 p-2">
                    <FormField
                      control={form.control}
                      name="assigneeId"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <UserSelector
                              value={field.value}
                              onValueChange={(value) => {
                                field.onChange(
                                  value === "unassigned" ? "" : value,
                                );
                                setAssigneeOpen(false);
                              }}
                              placeholder={t('placeholders.selectAssignee')}
                              teamId={teamId}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Labels Button */}
                <DropdownMenu open={labelsOpen} onOpenChange={setLabelsOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-8 w-8 p-0 relative",
                        selectedLabels.length > 0 &&
                          "bg-primary/10 border-primary/20",
                      )}
                    >
                      <Tag className="h-4 w-4" />
                      {selectedLabels.length > 0 && (
                        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-medium flex items-center justify-center">
                          {selectedLabels.length}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64">
                    <div className="space-y-1">
                      {labels.map((label) => {
                        const isSelected = selectedLabels.includes(label.id);
                        return (
                          <DropdownMenuItem
                            key={label.id}
                            onClick={() => toggleLabel(label.id)}
                            className={cn(
                              "flex items-center gap-2 cursor-pointer",
                              isSelected &&
                                "bg-primary/10 border-l-2 border-l-primary",
                            )}
                          >
                            <div
                              className={cn(
                                "h-3 w-3 rounded-full",
                                isSelected &&
                                  "ring-2 ring-primary ring-offset-1",
                              )}
                              style={{ backgroundColor: label.color }}
                            />
                            <span
                              className={cn(
                                "flex-1",
                                isSelected && "font-medium",
                              )}
                            >
                              {translateLabel(label.name, tCommon)}
                            </span>
                            {isSelected && (
                              <Check className="h-4 w-4 text-primary font-bold" />
                            )}
                          </DropdownMenuItem>
                        );
                      })}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* More Options Button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end px-6 py-4 border-t">
              <div className="flex items-center gap-3">
                {action === ISSUE_ACTION.CREATE && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {t('actions.createMore')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCreateMore(!createMore)}
                      className={cn(
                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                        createMore ? "bg-primary" : "bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                          createMore ? "translate-x-5" : "translate-x-0.5",
                        )}
                      />
                    </button>
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  onClick={async () => {
                    const data = form.getValues();
                    await handleSubmit(data);
                  }}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isSubmitting
                    ? action === ISSUE_ACTION.EDIT
                      ? t('actions.updating')
                      : t('actions.creating')
                    : action === ISSUE_ACTION.EDIT
                      ? t('actions.updateIssue')
                      : t('actions.createIssue')}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
