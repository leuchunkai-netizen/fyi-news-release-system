import { Search, Menu, User, LogOut, Settings, Upload, BookMarked, Shield, LayoutDashboard, ChevronDown } from "lucide-react";
import { Link, useLocation } from "react-router";
import { useUser } from "../context/UserContext";
import { UserAvatar } from "./UserAvatar";

const INTEREST_CATEGORY_SLUGS: Record<string, string> = {
  "World News": "world",
  Politics: "politics",
  Business: "business",
  Technology: "technology",
  Sports: "sports",
  Science: "science",
  Health: "health",
  Culture: "culture",
  Entertainment: "entertainment",
  Environment: "environment",
};

export function Header() {
  const { user, logout } = useUser();
  const location = useLocation();

  const navLinkClass = (href: string) => {
    const isActive =
      href === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(href);
    return [
      "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
      isActive
        ? "text-red-700 border-red-200 bg-red-50"
        : "text-gray-700 border-transparent hover:border-red-200 hover:bg-red-50",
    ].join(" ");
  };

  return (
    <header className="border-b sticky top-0 bg-background z-50">
      <div className="container mx-auto px-4">
        {/* Top bar */}
        <div className="flex items-center justify-between py-1 border-b">
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
                        <Link to="/billing" className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100">
                          <Settings className="w-4 h-4" />
                          Billing &amp; Plan
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
        <div className="flex items-center justify-between py-4">
          <button className="lg:hidden">
            <Menu className="w-6 h-6" />
          </button>
          <Link to="/" className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Mediaworks logo"
              className="h-12 w-auto md:h-16"
            />
          </Link>
          {/* Spacer to keep logo row balanced */}
          <div className="w-5 h-5" />
        </div>

        {/* Navigation - only for registered users */}
        {user && (
          <nav className="hidden lg:block border-t">
            <ul className="flex items-center gap-3 py-2 w-full">
              <li>
                <Link to="/" className={`${navLinkClass("/")} font-semibold`}>
                  Home
                </Link>
              </li>
              <>
                <li className="relative group">
                  <button className={navLinkClass("/category") + " gap-1"}>
                    News
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-56 bg-white border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    <ul className="py-2 text-sm">
                      <li>
                        <Link to="/category/world" className="block px-4 py-2 hover:bg-gray-100">
                          World
                        </Link>
                      </li>
                      <li>
                        <Link to="/category/politics" className="block px-4 py-2 hover:bg-gray-100">
                          Politics
                        </Link>
                      </li>
                      <li>
                        <Link to="/category/business" className="block px-4 py-2 hover:bg-gray-100">
                          Business
                        </Link>
                      </li>
                      <li>
                        <Link to="/category/technology" className="block px-4 py-2 hover:bg-gray-100">
                          Technology
                        </Link>
                      </li>
                      <li>
                        <Link to="/category/sports" className="block px-4 py-2 hover:bg-gray-100">
                          Sports
                        </Link>
                      </li>
                      <li>
                        <Link to="/category/science" className="block px-4 py-2 hover:bg-gray-100">
                          Science
                        </Link>
                      </li>
                      <li>
                        <Link to="/category/culture" className="block px-4 py-2 hover:bg-gray-100">
                          Culture
                        </Link>
                      </li>
                    </ul>
                  </div>
                </li>
                {(user.role === "free" || user.role === "premium") && user.interests && user.interests.length > 0 && (
                  <li className="relative group">
                    <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm text-gray-700 hover:bg-gray-100">
                      My Interests
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <div className="absolute left-0 mt-2 w-56 bg-white border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                      <ul className="py-2 text-sm">
                        {user.interests.map((interest) => {
                          const slug = INTEREST_CATEGORY_SLUGS[interest] ?? interest.toLowerCase().replace(/\s+/g, "-");
                          return (
                            <li key={interest}>
                              <Link
                                to={`/category/${slug}`}
                                className="block px-4 py-2 hover:bg-gray-100"
                              >
                                {interest}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </li>
                )}
                {(user.role === "free" || user.role === "premium") && (
                  <li>
                    <Link to="/my-articles" className={`${navLinkClass("/my-articles")} font-semibold`}>
                      My Articles
                    </Link>
                  </li>
                )}
                {(user.role === "free" || user.role === "premium") && (
                  <li>
                    <Link
                      to="/upload-article"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-red-600 to-red-500 shadow-sm hover:shadow-md hover:from-red-700 hover:to-red-600 transition-all duration-200 active:scale-[0.98]"
                    >
                      <Upload className="w-4 h-4" />
                      Upload Article
                    </Link>
                  </li>
                )}
                <li className="ml-auto">
                  <Link
                    to="/search"
                    className="inline-flex items-center justify-center p-2 rounded-full text-gray-700 hover:bg-gray-100"
                    aria-label="Search"
                  >
                    <Search className="w-5 h-5" />
                  </Link>
                </li>
              </>
            </ul>
          </nav>
        )}
      </div>
    </header>
  );
}