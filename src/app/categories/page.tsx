import { redirect } from "next/navigation";

export default function LegacyCategoriesRedirect() {
  redirect("/settings/categories");
}
