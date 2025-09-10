"use client";

import { UserButton } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

import { useCurrentTheme } from "@/hooks/use-current-theme";

interface UserControlProps {
  showName?: boolean;
}

const UserControl = ({ showName }: UserControlProps) => {
  const currentTheme = useCurrentTheme();

  return (
    <UserButton
      showName={showName}
      appearance={{
        elements: {
          userButtonBox: "rounded-md!",
          userButtonAvatarBox: "rounded-md! size-8!",
          userButtonTrigger: "rounded-md!",
        },
        // Force dark theme for the user profile/settings modal and dropdown
        baseTheme: dark,
      }}
    />
  );
};

export { UserControl };
