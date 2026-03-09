import { useState } from "react";
import { useNavigate } from "react-router";
import { useUser } from "../context/UserContext";
import { Check } from "lucide-react";

export function PersonalInfoPage() {
  const navigate = useNavigate();
  const { user, setUser } = useUser();

  const [gender, setGender] = useState<string>(user?.gender || "");
  const [interests, setInterests] = useState<string[]>(user?.interests || []);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-semibold mb-4">Let&apos;s start with your account</h1>
        <p className="text-muted-foreground mb-6">
          Please create an account or sign in before completing your personal information.
        </p>
        <button
          type="button"
          onClick={() => navigate("/signup")}
          className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 inline-block"
        >
          Create Account
        </button>
      </div>
    );
  }

  const availableInterests = [
    "World News",
    "Politics",
    "Business",
    "Technology",
    "Sports",
    "Science",
    "Health",
    "Culture",
    "Entertainment",
    "Environment",
  ];

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUser({
      ...user,
      gender,
      interests,
    });
    navigate("/profile");
  };

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-2xl mx-auto border rounded-lg p-8">
        <h1 className="text-3xl font-semibold mb-2">Complete your profile</h1>
        <p className="text-muted-foreground mb-6">
          Tell us a bit more about yourself so we can personalize your news experience.
        </p>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label className="block text-sm font-medium mb-2">Gender</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {["Male", "Female", "Non-binary", "Prefer not to say"].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setGender(option)}
                  className={`px-3 py-2 border-2 rounded-lg text-sm ${
                    gender === option ? "border-red-600 bg-red-50" : "border-gray-200"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Topics you&apos;re interested in</label>
            <p className="text-sm text-muted-foreground mb-3">
              Choose a few topics so we can recommend stories you care about most.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {availableInterests.map((interest) => (
                <button
                  key={interest}
                  type="button"
                  onClick={() => toggleInterest(interest)}
                  className={`p-3 border-2 rounded-lg text-left flex items-center justify-between ${
                    interests.includes(interest) ? "border-red-600 bg-red-50" : "border-gray-200"
                  }`}
                >
                  <span className="text-sm">{interest}</span>
                  {interests.includes(interest) && <Check className="w-4 h-4 text-red-600" />}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Save and continue
          </button>
        </form>
      </div>
    </div>
  );
}

