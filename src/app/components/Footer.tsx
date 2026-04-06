import { useEffect, useState } from "react";
import { Facebook, Twitter, Instagram, Youtube } from "lucide-react";
import { Link } from "react-router";
import { getCategories } from "../../lib/api/categories";
import type { CategoryRow } from "../../lib/types/database";

export function Footer() {
  const [sections, setSections] = useState<CategoryRow[]>([]);

  useEffect(() => {
    getCategories().then(setSections).catch(() => setSections([]));
  }, []);

  return (
    <footer className="bg-gray-900 text-white mt-10">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h4 className="font-semibold mb-4">Sections</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              {sections.length === 0 ? (
                <li className="text-gray-500">No categories available</li>
              ) : (
                sections.map((section) => (
                  <li key={section.id}>
                    <Link to={`/category/${section.slug}`} className="hover:text-white">
                      {section.name}
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link to="/info/about" className="hover:text-white">About Us</Link></li>
              <li><Link to="/info/contact" className="hover:text-white">Contact</Link></li>
              <li><Link to="/info/careers" className="hover:text-white">Careers</Link></li>
              <li><Link to="/info/privacy" className="hover:text-white">Privacy Policy</Link></li>
              <li><Link to="/info/terms" className="hover:text-white">Terms of Service</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Follow Us</h4>
            <div className="flex gap-4">
              <a href="https://www.facebook.com" target="_blank" rel="noopener noreferrer" className="hover:text-red-600 transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="hover:text-red-600 transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="https://www.instagram.com" target="_blank" rel="noopener noreferrer" className="hover:text-red-600 transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="https://www.youtube.com" target="_blank" rel="noopener noreferrer" className="hover:text-red-600 transition-colors">
                <Youtube className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-4 text-center text-sm text-gray-400">
          <p>© {new Date().getFullYear()} Mediaworks. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
