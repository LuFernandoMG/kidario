import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Pages
import Welcome from "./pages/Welcome";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import RecoverPassword from "./pages/RecoverPassword";
import ChooseProfile from "./pages/ChooseProfile";
import Explore from "./pages/Explore";
import TeacherProfile from "./pages/TeacherProfile";
import BookingScheduler from "./pages/BookingScheduler";
import Checkout from "./pages/Checkout";
import BookingConfirmation from "./pages/BookingConfirmation";
import Agenda from "./pages/Agenda";
import Progress from "./pages/Progress";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import TeacherPrivateSignup from "./pages/TeacherPrivateSignup";
import { TEACHER_PRIVATE_SIGNUP_PATH } from "./lib/privateRoutes";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Auth Flow */}
          <Route path="/" element={<Welcome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/recuperar-senha" element={<RecoverPassword />} />
          <Route path="/cadastro" element={<Signup />} />
          <Route path="/escolher-perfil" element={<ChooseProfile />} />
          <Route path="/escolher-professora" element={<ChooseProfile />} />
          <Route path={TEACHER_PRIVATE_SIGNUP_PATH} element={<TeacherPrivateSignup />} />
          {/* Parent Flow */}
          <Route path="/explorar" element={<Explore />} />
          <Route path="/professora/:id" element={<TeacherProfile />} />
          <Route path="/agendar/:id" element={<BookingScheduler />} />
          <Route path="/checkout/:id" element={<Checkout />} />
          <Route path="/confirmacao-reserva/:bookingId" element={<BookingConfirmation />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/progresso" element={<Progress />} />
          <Route path="/perfil" element={<Profile />} />
          
          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
