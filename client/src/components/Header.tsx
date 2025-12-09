import { useRef } from "react";
import { ShoppingCart, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  cartItemCount: number;
  onCartClick: () => void;
  onLogoClick?: () => void;
  isAdmin?: boolean;
}

export default function Header({ cartItemCount, onCartClick, onLogoClick, isAdmin = false }: HeaderProps) {
  const { user, logoutMutation } = useAuth();
  const cartFormRef = useRef<HTMLFormElement>(null);
  
  const handleLogoClick = () => {
    if (onLogoClick) {
      onLogoClick();
    }
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const handleCartClick = () => {
    // Submit goal form for Yandex tracking (use requestSubmit to trigger submit event)
    if (cartFormRef.current) {
      try {
        cartFormRef.current.requestSubmit();
      } catch (e) {
        console.warn("Goal form submit error:", e);
      }
    }
    onCartClick();
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <iframe
        name="goal-cart-iframe"
        style={{ display: 'none' }}
        aria-hidden="true"
      />
      <form
        ref={cartFormRef}
        id="goal-cart-form"
        action="/goal/cart"
        method="POST"
        target="goal-cart-iframe"
        style={{ display: 'none' }}
      >
        <input type="hidden" name="goal" value="cart" />
      </form>
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" onClick={handleLogoClick} data-testid="link-home">
            <h1 className="font-serif text-2xl md:text-3xl font-bold text-foreground cursor-pointer hover-elevate px-4 py-2 rounded-md transition-all">
              Пуэр Паб
            </h1>
          </Link>
          
          <div className="flex items-center gap-3 md:gap-4">
            {/* User auth button */}
            {!isAdmin && (
              <>
                {user ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-16 w-16 relative"
                        data-testid="button-user-menu"
                      >
                        <User className="w-12 h-12" />
                        {!user.firstOrderDiscountUsed && (
                          <Badge 
                            className="absolute -top-1 -right-2 h-6 min-w-[1.5rem] px-1.5 flex items-center justify-center bg-amber-500 text-white border-2 border-amber-600 text-xs font-bold z-10"
                            data-testid="badge-discount-available"
                          >
                            20%
                          </Badge>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>
                        {user.name || user.email}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/profile" data-testid="link-profile">
                          Личный кабинет
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={handleLogout}
                        data-testid="button-logout"
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Выйти
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button
                    variant="ghost"
                    className="relative"
                    asChild
                    data-testid="button-login"
                  >
                    <Link href="/auth">
                      Войти
                      <Badge 
                        className="absolute -top-1 -right-1 h-6 min-w-[1.5rem] px-1.5 flex items-center justify-center bg-amber-500 text-white border-2 border-amber-600 text-xs font-bold z-10"
                        data-testid="badge-login-discount"
                      >
                        20%
                      </Badge>
                    </Link>
                  </Button>
                )}
              </>
            )}
            
            {!isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                className="relative h-16 w-16"
                onClick={handleCartClick}
                data-testid="button-cart"
              >
                <ShoppingCart className="w-12 h-12" />
                {cartItemCount > 0 && (
                  <Badge 
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-primary text-primary-foreground border border-primary-border z-20"
                    data-testid="badge-cart-count"
                  >
                    {cartItemCount}
                  </Badge>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
