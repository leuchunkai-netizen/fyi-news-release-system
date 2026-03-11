import { Search, Menu, User, LogOut, Settings, Upload, BookMarked, Shield, LayoutDashboard } from "lucide-react";
import { Link } from "react-router";
import { useUser } from "../context/UserContext";
import { UserAvatar } from "./UserAvatar";

export function Header() {
  const { user, logout } = useUser();

  return (
    <header className="border-b sticky top-0 bg-background z-50">
      <div className="container mx-auto px-4">
        {/* Top bar */}
        <div className="flex items-center justify-between py-2 border-b">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">Thursday, February 19, 2026</span>
          </div>
          <div className="flex items-center gap-4">
            {!user ? (
              <>
                <Link to="/subscription" className="text-sm hover:underline">Subscribe</Link>
                <Link to="/login" className="text-sm hover:underline">Sign In</Link>
                <Link to="/signup" className="px-4 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700">
                  Create Account
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-4">
                <span className="text-sm">
                  {user.name} 
                  {user.role === "premium" && <span className="ml-2 px-2 py-0.5 bg-yellow-500 text-white text-xs rounded">Premium</span>}
                  {user.role === "expert" && <span className="ml-2 px-2 py-0.5 bg-blue-600 text-white text-xs rounded">Expert</span>}
                  {user.role === "admin" && <span className="ml-2 px-2 py-0.5 bg-purple-600 text-white text-xs rounded">Admin</span>}
                </span>
                <div className="relative group">
                  <button className="flex items-center gap-2">
                    <UserAvatar avatar={user.avatar} name={user.name} size="sm" />
                  </button>
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    <Link to="/profile" className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100">
                      <User className="w-4 h-4" />
                      Profile
                    </Link>
                    {user.role === "free" || user.role === "premium" ? (
                      <>
                        <Link to="/my-articles" className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100">
                          <Upload className="w-4 h-4" />
                          My Articles
                        </Link>
                      </>
                    ) : null}
                    {user.role === "premium" && (
                      <>
                        <Link to="/bookmarks" className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100">
                          <BookMarked className="w-4 h-4" />
                          Bookmarks
                        </Link>
                        <Link to="/subscription-manage" className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100">
                          <Settings className="w-4 h-4" />
                          Manage Subscription
                        </Link>
                      </>
                    )}
                    {user.role === "expert" && (
                      <Link to="/expert-dashboard" className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100">
                        <Shield className="w-4 h-4" />
                        Expert Dashboard
                      </Link>
                    )}
                    {user.role === "admin" && (
                      <Link to="/admin" className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100">
                        <LayoutDashboard className="w-4 h-4" />
                        Admin Dashboard
                      </Link>
                    )}
                    <button onClick={logout} className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 w-full text-left border-t">
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Logo and search */}
        <div className="flex items-center justify-between py-6">
          <button className="lg:hidden">
            <Menu className="w-6 h-6" />
          </button>
          <Link to="/" className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Mediaworks logo"
              className="h-20 w-auto md:h-22"
            />
          </Link>
          {/* Search - Only for registered users (free, premium, expert, admin) */}
          {user ? (
            <Link to="/search">
              <Search className="w-5 h-5" />
            </Link>
          ) : (
            <div className="w-5 h-5" /> // Placeholder to maintain layout
          )}
        </div>

        {/* Navigation */}
        <nav className="hidden lg:block border-t">
          <ul className="flex items-center justify-center gap-8 py-3">
            <li>
              <Link to="/" className="hover:underline">
                Home
              </Link>
            </li>
            {user && (
              <>
                <li>
                  <Link to="/category/world" className="hover:underline">
                    World
                  </Link>
                </li>
                <li>
                  <Link to="/category/politics" className="hover:underline">
                    Politics
                  </Link>
                </li>
                <li>
                  <Link to="/category/business" className="hover:underline">
                    Business
                  </Link>
                </li>
                <li>
                  <Link to="/category/technology" className="hover:underline">
                    Technology
                  </Link>
                </li>
                <li>
                  <Link to="/category/sports" className="hover:underline">
                    Sports
                  </Link>
                </li>
                <li>
                  <Link to="/category/science" className="hover:underline">
                    Science
                  </Link>
                </li>
                <li>
                  <Link to="/category/culture" className="hover:underline">
                    Culture
                  </Link>
                </li>
                {(user.role === "free" || user.role === "premium") && (
                  <li>
                    <Link
                      to="/upload-article"
                      className="px-4 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Upload Article
                    </Link>
                  </li>
                )}
              </>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
}