import { redirect } from "next/navigation";

/**
 * "Main Loan Categories" (and their legacy sub categories) no longer exist: a loan category belongs directly to one customer
 * type. Old bookmarks /settings/main-categories and /settings/main-categories/:id land on Settings → Loan Categories.
 */
export default function MainCategoriesRedirect() {
  redirect("/settings/loan-categories");
}
