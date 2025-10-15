import { ShoppingCart, User, LogOut } from "lucide-react";
import { SiTelegram, SiVk } from "react-icons/si";
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
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" onClick={handleLogoClick} data-testid="link-home">
            <h1 className="font-serif text-2xl md:text-3xl font-bold text-foreground cursor-pointer hover-elevate px-4 py-2 rounded-md transition-all">
              Пуэр Паб
            </h1>
          </Link>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="hidden md:inline-flex"
              data-testid="link-telegram"
            >
              <a href="https://t.me/puerpub" target="_blank" rel="noopener noreferrer">
                <SiTelegram className="w-5 h-5" />
              </a>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="hidden md:inline-flex"
              data-testid="link-vk"
            >
              <a href="https://vk.com/puerpab" target="_blank" rel="noopener noreferrer">
                <SiVk className="w-5 h-5" />
              </a>
            </Button>
            
            {/* User auth button */}
            {!isAdmin && (
              <>
                {user ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-12 w-12"
                        data-testid="button-user-menu"
                      >
                        <User className="w-6 h-6" />
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
            
            {!isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                className="relative h-12 w-12"
                onClick={onCartClick}
                data-testid="button-cart"
              >
                <ShoppingCart className="w-6 h-6" />
                {cartItemCount > 0 && (
                  <Badge 
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-primary text-primary-foreground border border-primary-border"
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
