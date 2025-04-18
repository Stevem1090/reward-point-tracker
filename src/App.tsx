
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
import { RefreshCw, Trash2, AlertCircle } from "lucide-react";
import { useToast } from "./hooks/use-toast";

const queryClient = new QueryClient();

// Create a separate function for service worker registration with enhanced error handling and timeout
const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      console.log('Starting service worker registration process...');
      
      // Create a promise that times out after 5 seconds
      const registrationPromise = Promise.race([
        (async () => {
          // Unregister any existing service workers first to ensure clean state
          const registrations = await navigator.serviceWorker.getRegistrations();
          
          if (registrations.length > 0) {
            for (const registration of registrations) {
              await registration.unregister();
              console.log('Unregistered existing service worker');
            }
          } else {
            console.log('No existing service workers to unregister');
          }
          
          // Register the service worker with new cache settings
          const registration = await navigator.serviceWorker.register('/sw.js', { 
            updateViaCache: 'none', // Never use cached version of the SW
            scope: '/'
          });
          
          console.log('ServiceWorker registration successful with scope:', registration.scope);
          return { success: true, registration };
        })(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Service worker registration timed out')), 5000)
        )
      ]);
      
      const result = await registrationPromise;
      
      // Check for updates every 3 minutes (reduced from 5 minutes)
      if (result.success && result.registration) {
        setInterval(() => {
          result.registration.update().catch(err => {
            console.error('Service worker update failed:', err);
          });
          console.log('Service worker update check initiated');
        }, 3 * 60 * 1000);
      }
      
      return result;
    } catch (error) {
      console.error('ServiceWorker registration failed:', error);
      return { success: false, error };
    }
  }
  
  console.log('Service workers not supported in this browser');
  return { success: false, error: new Error('Service workers not supported') };
};

const App = () => {
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [swStatus, setSwStatus] = useState<'loading' | 'success' | 'error' | 'unsupported' | 'timeout'>('loading');
  const [isRefreshingSubscriptions, setIsRefreshingSubscriptions] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [initTimeout, setInitTimeout] = useState<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  
  // Clear all caches function with improved feedback
  const clearAllCaches = async () => {
    try {
      setIsClearingCache(true);
      
      if ('caches' in window) {
        // Clear all application caches
        const cacheKeys = await caches.keys();
        console.log('Found caches to clear:', cacheKeys);
        await Promise.all(cacheKeys.map(key => caches.delete(key)));
        console.log('All application caches cleared successfully');
      }
      
      // Send message to service worker to clear its caches
      if (swRegistration && swRegistration.active) {
        swRegistration.active.postMessage({ type: 'CLEAR_CACHES' });
        console.log('Sent cache clear message to service worker');
      }
      
      // Unregister service worker
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
          console.log('Unregistered service worker during cache clearing');
        }
      }
      
      toast({
        title: "Cache Cleared",
        description: "Refreshing the app with clean caches...",
      });
      
      // Small delay to allow toast to show
      setTimeout(() => {
        // Refresh the page after clearing caches
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error clearing caches:', error);
      toast({
        title: "Error Clearing Cache",
        description: "Please try again or reload the page manually",
        variant: "destructive"
      });
      setIsClearingCache(false);
    }
  };

  // Force Service Worker to update with enhanced error handling
  const updateServiceWorker = async () => {
    if (!('serviceWorker' in navigator)) {
      toast({
        title: "Not Supported",
        description: "Service workers not supported in this browser",
        variant: "destructive"
      });
      return;
    }
    
    try {
      console.log('Starting service worker update process');
      setIsRefreshingSubscriptions(true);
      
      // Unregister existing service workers
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length > 0) {
        for (const registration of registrations) {
          await registration.unregister();
          console.log('Unregistered service worker during update');
        }
      }
      
      // Re-register the service worker
      const result = await registerServiceWorker();
      
      if (result.success) {
        setSwRegistration(result.registration);
        setSwStatus('success');
        toast({
          title: "Service Worker Updated",
          description: "Application refreshed with latest version",
        });
      } else {
        setSwStatus('error');
        throw result.error;
      }
    } catch (error) {
      console.error('Error updating service worker:', error);
      toast({
        title: "Update Failed",
        description: "Could not update application service worker",
        variant: "destructive"
      });
    } finally {
      // Brief delay before resetting state
      setTimeout(() => {
        setIsRefreshingSubscriptions(false);
      }, 1000);
    }
  };
  
  // Register service worker when component mounts with timeout safety
  useEffect(() => {
    const initServiceWorker = async () => {
      try {
        console.log('Initializing service worker...');
        
        // Set a timeout to prevent infinite loading
        const timeout = setTimeout(() => {
          console.log('Service worker initialization timed out');
          setSwStatus('timeout');
          
          toast({
            title: "App Loading Issue",
            description: "The app is taking too long to load. Try clearing your cache.",
            variant: "destructive"
          });
        }, 10000); // 10 second timeout
        
        setInitTimeout(timeout);
        
        const result = await registerServiceWorker();
        
        // Clear timeout as we got a response
        clearTimeout(timeout);
        setInitTimeout(null);
        
        if (result.success) {
          setSwRegistration(result.registration);
          setSwStatus('success');
          console.log('Service worker registered successfully');
        } else {
          // Proceed with the app even if SW fails
          setSwStatus('error');
          console.error('Service worker registration failed:', result.error);
          
          // Only show error toast for serious errors, not unsupported browsers
          if (result.error?.message !== 'Service workers not supported') {
            toast({
              title: "Service Worker Error",
              description: "App may have limited functionality. Try clearing your cache.",
              variant: "destructive"
            });
          } else {
            setSwStatus('unsupported');
          }
        }
      } catch (error) {
        console.error('Error during service worker initialization:', error);
        setSwStatus('error');
        
        // Clear timeout if it exists
        if (initTimeout) {
          clearTimeout(initTimeout);
          setInitTimeout(null);
        }
      }
    };
    
    initServiceWorker();
    
    // Cleanup any pending timeouts
    return () => {
      if (initTimeout) {
        clearTimeout(initTimeout);
      }
    };
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
              
              {/* Enhanced status banner with more informative state handling */}
              {(swStatus === 'error' || swStatus === 'timeout' || isClearingCache || isRefreshingSubscriptions) && (
                <div className={`p-2 flex justify-center items-center gap-2 ${
                  swStatus === 'error' || swStatus === 'timeout' ? 'bg-red-100' : 'bg-amber-100'
                }`}>
                  {(swStatus === 'error' || swStatus === 'timeout') && <AlertCircle className="h-4 w-4 text-red-600" />}
                  
                  <p className={`text-sm mr-2 ${
                    swStatus === 'error' || swStatus === 'timeout' ? 'text-red-800' : 'text-amber-800'
                  }`}>
                    {swStatus === 'error' 
                      ? "App may have limited functionality." 
                      : swStatus === 'timeout'
                        ? "App is taking too long to load."
                        : isClearingCache 
                          ? "Clearing cache..." 
                          : isRefreshingSubscriptions 
                            ? "Refreshing app..." 
                            : "Having trouble loading the app?"}
                  </p>
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className={`border-amber-800 hover:bg-amber-800 hover:text-white ${
                      swStatus === 'error' || swStatus === 'timeout' ? 'text-red-800 border-red-800 hover:bg-red-800' : 'text-amber-800'
                    }`}
                    onClick={clearAllCaches}
                    disabled={isClearingCache}
                  >
                    <Trash2 className={`h-4 w-4 mr-1 ${isClearingCache ? 'animate-spin' : ''}`} /> 
                    {isClearingCache ? 'Clearing...' : 'Clear Cache'}
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className={`border-amber-800 hover:bg-amber-800 hover:text-white ${
                      swStatus === 'error' || swStatus === 'timeout' ? 'text-red-800 border-red-800 hover:bg-red-800' : 'text-amber-800'
                    }`}
                    onClick={updateServiceWorker}
                    disabled={isRefreshingSubscriptions}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshingSubscriptions ? 'animate-spin' : ''}`} /> 
                    {isRefreshingSubscriptions ? 'Refreshing...' : 'Refresh App'}
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
