// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DesignSystemPage } from "./DesignSystemPage";

test("shows every piece in vellum and in ink, side by side", () => {
  const { container } = render(
    <TooltipProvider>
      <DesignSystemPage />
    </TooltipProvider>,
  );
  const schemes = [...container.querySelectorAll("[data-scheme]")].map((el) =>
    el.getAttribute("data-scheme"),
  );
  expect(schemes).toEqual(["light", "dark"]);
  for (const name of ["Vélin (clair)", "Encre (sombre)"]) {
    const specimen = screen.getByRole("heading", { name }).parentElement as HTMLElement;
    const inside = within(specimen);
    expect(inside.getByRole("button", { name: "Nouvelle fiche" })).toBeDefined();
    expect(inside.getByRole("button", { name: "Désactivé" })).toHaveProperty("disabled", true);
    expect(inside.getByLabelText("En erreur").getAttribute("aria-invalid")).toBe("true");
    expect(inside.getByRole("switch", { name: "Interrupteur" })).toBeDefined();
    expect(inside.getByRole("tab", { name: "Carte" })).toBeDefined();
    expect(inside.getByTestId("atlas")).toBeDefined();
  }
});
