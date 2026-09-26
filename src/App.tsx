import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import AuthGuard from "./components/AuthGuard";
import AppLayout from "./components/AppLayout";
import RewardsPage from "./pages/RewardsPage";
import CalendarPage from "./pages/CalendarPage";
import ListsPage from "./pages/ListsPage";
import RemindersPage from "./pages/RemindersPage";
import ProfilePage from "./pages/ProfilePage";
import BillsPage from "./pages/BillsPage";
import MealPlanningPage from "./pages/MealPlanningPage";
import ChoresPage from "./pages/ChoresPage";
import SlimmingWorldPage from "./pages/SlimmingWorldPage";
import TasksPage from "./pages/TasksPage";
import DashboardPage from "./pages/DashboardPage";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";
import JoinPage from "./pages/JoinPage";
import FamilyGate from "./components/FamilyGate";
import { useEffect } from "react";
import { refreshPushToken, retireOldServiceWorker } from "./lib/push/registerPush";

const queryClient = new QueryClient();

// Keeps this device's notification token fresh once signed in (never prompts).
const PushRefresher = () => {
  const { user } = useAuth();
  useEffect(() => {
    if (user?.id) refreshPushToken();
  }, [user?.id]);
  return null;
};

const App = () => {
  useEffect(() => {
    retireOldServiceWorker();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <AuthProvider>
            <PushRefresher />
            <div className="min-h-screen flex flex-col">
              <div className="flex-1">
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/join" element={<JoinPage />} />

                  <Route element={<AuthGuard><FamilyGate><AppLayout /></FamilyGate></AuthGuard>}>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/rewards" element={<RewardsPage />} />
                    <Route path="/calendar" element={<CalendarPage />} />
                    <Route path="/lists" element={<ListsPage />} />
                    <Route path="/reminders" element={<RemindersPage />} />
                    <Route path="/tasks" element={<TasksPage />} />
                    <Route path="/bills" element={<BillsPage />} />
                    <Route path="/meals" element={<MealPlanningPage />} />
                    <Route path="/chores" element={<ChoresPage />} />
                    <Route path="/slimming-world" element={<SlimmingWorldPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                  </Route>

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </div>
            </div>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
