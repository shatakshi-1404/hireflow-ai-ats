import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { router } from "@/app/router";

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="top-right" richColors closeButton />
    </>
  );
}
