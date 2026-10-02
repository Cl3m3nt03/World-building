import { useNavigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImagePickerDialog } from "@/features/media";
import { useCreateMap } from "../hooks/useMaps";
import { PreparingMapDialog } from "./PreparingMapDialog";

/**
 * "New map": the image picker chooses the background, then the map is
 * created ("Untitled map", one layer) and opens.
 */
export function CreateMapDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { worldId } = useParams({ strict: false });
  const navigate = useNavigate();
  const create = useCreateMap();

  return (
    <>
      <ImagePickerDialog
        open={open}
        onOpenChange={onOpenChange}
        title={t("maps.chooseBackground")}
        onPick={(backgroundAssetId) =>
          create.mutate(
            { title: t("maps.untitled"), backgroundAssetId, layerName: t("maps.defaultLayer") },
            {
              onSuccess: (map) => {
                if (worldId) {
                  void navigate({
                    to: "/world/$worldId/world/map/$mapId",
                    params: { worldId, mapId: map.id },
                  });
                }
              },
            },
          )
        }
      />
      <PreparingMapDialog pending={create.isPending} />
      <Dialog open={create.isError} onOpenChange={(next) => !next && create.reset()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("maps.createFailed.title")}</DialogTitle>
            <DialogDescription>{t("maps.createFailed.description")}</DialogDescription>
          </DialogHeader>
          {create.isError && <AppErrorMessage error={create.error} />}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">{t("maps.createFailed.close")}</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
