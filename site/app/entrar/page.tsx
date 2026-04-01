import { redirect } from "next/navigation";

import { LOGIN_URL } from "../../lib/site-config";

export default function EntrarPage() {
  redirect(LOGIN_URL);
}
