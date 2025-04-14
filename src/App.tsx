
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import AuthGuard from "./components/AuthGuard";
import NavBar from "./components/NavBar";
import AppLayout from "./components/AppLayout";
import RewardsPage from "./pages/RewardsPage";
import CalendarPage from "./pages/CalendarPage";
import ListsPage from "./pages/ListsPage";
import RemindersPage from "./pages/RemindersPage";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Register service worker for push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('ServiceWorker registration successful');
    }).catch(error => {
      console.log('ServiceWorker registration failed:', error);
    });
  });
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <div className="min-h-screen flex flex-col">
            <NavBar />
            <div className="flex-1">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                
                {/* Authenticated Routes */}
                <Route element={<AuthGuard><AppLayout /></AuthGuard>}>
                  <Route path="/" element={<Navigate to="/rewards" replace />} />
                  <Route path="/rewards" element={<RewardsPage />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/lists" element={<ListsPage />} />
                  <Route path="/reminders" element={<RemindersPage />} />
                </Route>
                
                {/* Catch-all route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
          </div>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
