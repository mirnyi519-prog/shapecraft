import { redirect } from "next/navigation";

export default function LegacyWorldRedirect() {
  redirect("/settings/world");
}
