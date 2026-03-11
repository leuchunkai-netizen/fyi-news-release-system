import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import { User } from "lucide-react";

interface UserAvatarProps {
  avatar?: string | null;
  name?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "size-8",
  md: "size-10",
  lg: "size-24",
};

export function UserAvatar({ avatar, name, className, size = "md" }: UserAvatarProps) {
  const initial = name?.trim()?.[0]?.toUpperCase() ?? null;
  return (
    <Avatar className={`${sizeClasses[size]} ${className ?? ""}`}>
      {avatar ? (
        <AvatarImage src={avatar} alt={name ?? "Avatar"} />
      ) : null}
      <AvatarFallback className="bg-gray-300 text-gray-600">
        {initial ? initial : <User className="size-1/2" />}
      </AvatarFallback>
    </Avatar>
  );
}
