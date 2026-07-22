import Link from "next/link";

export function Logo() {
  return (
    <Link className="logo" href="/" aria-label="FirstContact home">
      <span className="logo-mark" aria-hidden="true"><i /><i /><i /></span>
      <span>FIRSTCONTACT</span>
    </Link>
  );
}
