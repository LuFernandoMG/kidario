import { PlaceholderScreen } from "@/components/common/PlaceholderScreen";

export default function NotFoundScreen() {
  return (
    <PlaceholderScreen
      eyebrow="Route Missing"
      title="Screen not found"
      description="The requested mobile route does not exist in the current scaffold."
      links={[
        { href: "/", label: "Back to root" },
        { href: "/login", label: "Open shared route" },
        { href: "/explore", label: "Open parent route" },
        { href: "/home", label: "Open teacher route" },
      ]}
    />
  );
}
