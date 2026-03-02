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

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <iframe
        name="goal-cart-iframe"
        style={{ display: 'none', width: 0, height: 0, border: 'none' }}
        aria-hidden="true"
      />
      <iframe
        name="goal-contact-iframe"
        style={{ display: 'none', width: 0, height: 0, border: 'none' }}
        aria-hidden="true"
      />
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Left side: Logo */}
          <div className="flex items-center">
            <Link href="/" onClick={handleLogoClick} data-testid="link-home">
              <h1 className="font-serif text-2xl md:text-3xl font-bold text-foreground cursor-pointer hover-elevate px-2 sm:px-4 py-2 rounded-md transition-all">
                Пуэр Паб
              </h1>
            </Link>
          </div>
          
          <div className="flex items-center gap-4 md:gap-4">
            
            {/* Contact button - mobile: "Написать", desktop: "Связаться с нами" */}
            {!isAdmin && (
              <form
                id="goal-contact-form"
                name="contact-telegram"
                action="/goal/contact"
                method="POST"
                target="goal-contact-iframe"
                className="ym-disable-keys block"
                onSubmit={() => {
                  setTimeout(() => {
                    window.open("https://t.me/PuerPabbot?start=ask", "_blank", "noopener,noreferrer");
                  }, 0);
                }}
                data-testid="form-contact-goal"
              >
                <input type="hidden" name="goal" value="contact" />
                <input type="hidden" name="form_name" value="contact-telegram" />
                <Button
                  type="submit"
                  className="btn-secondary px-3 sm:px-5 py-2 text-sm flex items-center no-default-hover-elevate no-default-active-elevate"
                  data-testid="button-contact"
                >
                  <span className="sm:hidden">Написать</span>
                  <span className="hidden sm:inline">Связаться с нами</span>
                </Button>
              </form>
            )}
            
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
                    </Link>
                  </Button>
                )}
              </>
            )}
            
            {/* Cart button in header - hidden on mobile, shown on desktop */}
            {!isAdmin && (
              <form
                ref={cartFormRef}
                id="goal-cart-form"
                action="/goal/cart"
                method="POST"
                target="goal-cart-iframe"
                onSubmit={(e) => {
                  // Allow form to submit, then trigger cart action
                  setTimeout(() => onCartClick(), 0);
                }}
                data-testid="form-cart-goal"
                className="hidden sm:block"
              >
                <input type="hidden" name="goal" value="cart" />
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  className="relative h-16 w-16"
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
              </form>
            )}
          </div>
        </div>
      </div>

    </header>
  );
}
