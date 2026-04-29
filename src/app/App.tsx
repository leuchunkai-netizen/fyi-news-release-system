import { RouterProvider } from "react-router";
import { Toaster } from "sonner";
import { UserProvider } from "./context/UserContext";
import { GuestLandingProvider } from "./context/GuestLandingContext";
import { TestimonialsProvider } from "./context/TestimonialsContext";
import { router } from "./routes";

function App() {
  return (
    <UserProvider>
      <GuestLandingProvider>
        <TestimonialsProvider>
          <RouterProvider router={router} />
          <Toaster richColors position="top-right" />
        </TestimonialsProvider>
      </GuestLandingProvider>
    </UserProvider>
  );
}

export default App;
