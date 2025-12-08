import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Admin from "@/pages/Admin";
import Auth from "@/pages/Auth";
import Profile from "@/pages/Profile";
import PaymentSuccess from "@/pages/PaymentSuccess";
import PaymentError from "@/pages/PaymentError";
import { useDesignMode } from "@/hooks/use-design-mode";
import { AuthProvider } from "@/hooks/use-auth";
import { GoalForms } from "@/components/GoalForms";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/admin" component={Admin} />
      <Route path="/auth" component={Auth} />
      <Route path="/profile" component={Profile} />
      <Route path="/payment/success" component={PaymentSuccess} />
      <Route path="/payment/error" component={PaymentError} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  useDesignMode(); // Apply design mode class to body
  
  return (
    <>
      <Toaster />
      <GoalForms />
      <Router />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
