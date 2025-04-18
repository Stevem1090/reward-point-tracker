
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
import ProfilePage from "./pages/ProfilePage";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";
import { useEffect, useState } from "react";
import { Button } from "./components/ui/button";
import { RefreshCw, Trash2 } from "lucide-react";

const queryClient = new QueryClient();

// Create a separate function for service worker registration
const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      // Unregister any existing service workers first to ensure clean state
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
        console.log('Unregistered existing service worker');
      }
      
      // Register the service worker with new cache settings
      const registration = await navigator.serviceWorker.register('/sw.js', { 
        updateViaCache: 'none', // Never use cached version of the SW
        scope: '/'
      });
      
      // Check for updates every 5 minutes (reduced from hourly)
      setInterval(() => {
        registration.update().catch(err => {
          console.error('Service worker update failed:', err);
        });
        console.log('Service worker update check initiated');
      }, 5 * 60 * 1000);
      
      console.log('ServiceWorker registration successful with scope:', registration.scope);
      return true;
    } catch (error) {
      console.error('ServiceWorker registration failed:', error);
      return false;
    }
  }
  return false;
};

const App = () => {
  const [swRegistered, setSwRegistered] = useState(false);
  const [showClearCacheButton, setShowClearCacheButton] = useState(false);
  const [isRefreshingSubscriptions, setIsRefreshingSubscriptions] = useState(false);
  
  // Clear all caches function
  const clearAllCaches = async () => {
    try {
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map(key => caches.delete(key)));
        console.log('All caches cleared successfully');
        
        // Refresh the page after clearing caches
        window.location.reload();
      }
    } catch (error) {
      console.error('Error clearing caches:', error);
    }
  };

  // Force Service Worker to update
  const updateServiceWorker = async () => {
    if (!('serviceWorker' in navigator)) return;
    
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length > 0) {
        // Send message to skip waiting
        registrations.forEach(registration => {
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        });
        
        console.log('Service worker update requested');
      }
      
      // Re-register the service worker
      await registerServiceWorker();
      
    } catch (error) {
      console.error('Error updating service worker:', error);
    }
  };
  
  // Refresh push notification subscriptions
  const refreshSubscriptions = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push notifications not supported');
      return;
    }
    
    try {
      setIsRefreshingSubscriptions(true);
      
      // First update the service worker
      await updateServiceWorker();
      
      // Check for stale subscriptions and clean them up
      // This will be handled in the useUserNotifications hook when users visit pages
      // that use push notifications
      
      console.log('Push notification subscriptions refresh initiated');
      
      // Brief delay to allow state to update
      setTimeout(() => {
        setIsRefreshingSubscriptions(false);
      }, 2000);
      
    } catch (error) {
      console.error('Error refreshing push subscriptions:', error);
      setIsRefreshingSubscriptions(false);
    }
  };
  
  // Register service worker when component mounts
  useEffect(() => {
    const initServiceWorker = async () => {
      const registered = await registerServiceWorker();
      setSwRegistered(registered);
      
      // Check if we've had registration problems
      const hasFailedBefore = localStorage.getItem('sw-failed') === 'true';
      setShowClearCacheButton(hasFailedBefore || !registered);
      
      if (!registered) {
        localStorage.setItem('sw-failed', 'true');
      } else {
        localStorage.removeItem('sw-failed');
      }
    };
    
    initServiceWorker();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <div className="min-h-screen flex flex-col">
              <NavBar />
              {showClearCacheButton && (
                <div className="bg-amber-100 p-2 flex justify-center items-center gap-2">
                  <p className="text-amber-800 text-sm mr-2">Having trouble loading the app?</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-amber-800 border-amber-800 hover:bg-amber-800 hover:text-white"
                    onClick={clearAllCaches}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Clear Cache
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-amber-800 border-amber-800 hover:bg-amber-800 hover:text-white"
                    onClick={refreshSubscriptions}
                    disabled={isRefreshingSubscriptions}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshingSubscriptions ? 'animate-spin' : ''}`} /> 
                    {isRefreshingSubscriptions ? 'Refreshing...' : 'Refresh Notifications'}
                  </Button>
                </div>
              )}
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
                    <Route path="/profile" element={<ProfilePage />} />
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
};

export default App;
