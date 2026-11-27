import type { Metadata } from "next";
import { ProjectsPage } from "@/features/factory/components/projects-page";
import { SignInGate } from "@/features/session/components/sign-in-screen";

export const metadata: Metadata = { title: "Projects", robots: { index: false } };

/**
 * The app factory's portfolio (E5-T3). One exported page, `projects.html`, answered for `/projects`
 * by the static server's own `try_files`; the page reads factory-board with the edge's session and
 * holds no project data itself. Layout and the sign-in gate are the same as the other signed-in
 * pages; Caddy serves `/board/*` from the same origin, where it strips the prefix before proxying.
 */
export default function Projects() {
  return (
    <SignInGate>
      <ProjectsPage />
    </SignInGate>
  );
}
