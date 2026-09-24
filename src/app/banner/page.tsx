import { redirect } from "next/navigation";

export default function LegacyBannerRedirect() {
  redirect("/settings/banner");
}
