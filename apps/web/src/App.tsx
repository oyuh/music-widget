import Callback from "./pages/callback";
import EditorPage from "./pages";
import WidgetPage from "./pages/w";

export default function App() {
  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";

  if (pathname === "/w") return <WidgetPage />;
  if (pathname === "/callback") return <Callback />;

  return <EditorPage />;
}
