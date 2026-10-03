import { CircleDashed, Plus, Settings2 } from "lucide-react";
import { type ReactNode, type SyntheticEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { RelationType } from "@/lib/bindings";
import { useCreateRelationType } from "../hooks/useTrees";
import { relationIcon, relationName } from "../relations";
import { emptyRelationInput, RelationTypeForm } from "./RelationTypeForm";

type MenuProps = {
  /** The trigger: a « + » around a node, or the node bar's button. */
  children: ReactNode;
  relationTypes: RelationType[];
  /** A relation was picked (`null`: « skip for now », a link without a type). */
  onPick: (type: RelationType | null) => void;
  side?: "top" | "right" | "bottom" | "left";
  /** Opens the window that manages the world's relation types. */
  onManage?: () => void;
  /** Opened from outside (a link just drawn); the menu stays usable alone. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const SECTIONS = [
  { category: "family", label: "trees.relations.family" },
  { category: "couple", label: "trees.relations.couple" },
  { category: "custom", label: "trees.relations.custom" },
] as const;

/**
 * The list of relations a « + » offers (docs/features/05-relation-tree.md):
 * family, couple, the world's own types, « Skip for now » and « Custom
 * relation… », which names a new type with its icon.
 */
export function RelationMenu({
  children,
  relationTypes,
  onPick,
  side = "bottom",
  open,
  onOpenChange,
  onManage,
}: MenuProps) {
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);
  // Once a relation is picked, the focus goes to the new node's search, not
  // back to the trigger (which would close that search at once).
  const picked = useRef(false);
  const pick = (type: RelationType | null) => {
    picked.current = true;
    onPick(type);
  };
  // The menu and the dialog are portals, but their events still bubble
  // through React to the node holding the « + »: React Flow would select it
  // again (click) or move it (keys). They stop here.
  const stop = (event: SyntheticEvent) => event.stopPropagation();
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: only stops events from bubbling
    <span className="contents" onClick={stop} onDoubleClick={stop} onKeyDown={stop}>
      <DropdownMenu
        modal={false}
        {...(open === undefined ? {} : { open })}
        {...(onOpenChange ? { onOpenChange } : {})}
      >
        <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
        <DropdownMenuContent
          side={side}
          align="center"
          className="w-72"
          onCloseAutoFocus={(event) => {
            if (picked.current || creating) event.preventDefault();
            picked.current = false;
          }}
        >
          {SECTIONS.map(({ category, label }) => {
            const types = relationTypes.filter((type) =>
              category === "custom"
                ? type.category === "custom" || type.category === "other"
                : type.category === category,
            );
            if (types.length === 0) return null;
            return (
              <DropdownMenuGroup key={category}>
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  {t(label)}
                </DropdownMenuLabel>
                <div className="grid grid-cols-2">
                  {types.map((type) => {
                    const Icon = relationIcon(type.icon);
                    return (
                      <DropdownMenuItem key={type.id} onSelect={() => pick(type)}>
                        <Icon aria-hidden />
                        <span className="truncate">{relationName(type, t)}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </div>
              </DropdownMenuGroup>
            );
          })}
          <DropdownMenuSeparator />
          <div className="grid grid-cols-2">
            <DropdownMenuItem onSelect={() => setCreating(true)}>
              <Plus aria-hidden />
              {t("trees.relations.newCustom")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => pick(null)}>
              <CircleDashed aria-hidden />
              {t("trees.relations.skip")}
            </DropdownMenuItem>
          </div>
          {onManage && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onManage}>
                <Settings2 aria-hidden />
                {t("trees.relationTypes.manage")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <CustomRelationDialog
        open={creating}
        onOpenChange={setCreating}
        relationTypes={relationTypes}
        onCreated={(type) => {
          setCreating(false);
          pick(type);
        }}
      />
    </span>
  );
}

/** Names a new relation type of the world (icon, category, inverse) and uses it at once. */
function CustomRelationDialog({
  open,
  onOpenChange,
  relationTypes,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relationTypes: RelationType[];
  onCreated: (type: RelationType) => void;
}) {
  const { t } = useTranslation();
  const create = useCreateRelationType();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("trees.relations.customTitle")}</DialogTitle>
          <DialogDescription>{t("trees.relations.customDescription")}</DialogDescription>
        </DialogHeader>
        {create.error && <AppErrorMessage error={create.error} />}
        {open && (
          <RelationTypeForm
            initial={emptyRelationInput()}
            relationTypes={relationTypes}
            editingId={null}
            onSubmit={(input) => create.mutate(input, { onSuccess: onCreated })}
          >
            {(valid) => (
              <DialogFooter>
                <Button type="submit" disabled={!valid || create.isPending}>
                  {t("trees.relations.customSubmit")}
                </Button>
              </DialogFooter>
            )}
          </RelationTypeForm>
        )}
      </DialogContent>
    </Dialog>
  );
}
