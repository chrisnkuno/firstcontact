export default function Template({ children }: { children: React.ReactNode }) {
  // Keep the server-rendered document visible. Interactive drawers and panels
  // own their transitions without making first paint depend on hydration.
  return <div className="page-slide">{children}</div>;
}
