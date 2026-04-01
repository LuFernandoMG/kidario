import { redirect } from "next/navigation";

import { CADASTRO_URL } from "../../lib/site-config";

export default function CadastroPage() {
  redirect(CADASTRO_URL);
}
