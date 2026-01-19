import { SignUp } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <SignUp
        forceRedirectUrl="/dashboard"
        appearance={{
          baseTheme: dark,
          elements: {
            rootBox: "mx-auto",
            card: "bg-zinc-900 border border-zinc-800 shadow-2xl",
            headerTitle: "text-white",
            headerSubtitle: "text-zinc-400",
            socialButtonsBlockButton:
              "bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700",
            socialButtonsBlockButtonText: "text-white font-medium",
            dividerLine: "bg-zinc-700",
            dividerText: "text-zinc-500",
            formFieldLabel: "text-zinc-300",
            formFieldInput:
              "bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-purple-500 focus:ring-purple-500",
            formButtonPrimary:
              "bg-purple-600 hover:bg-purple-700 text-white font-medium",
            footerActionLink: "text-purple-400 hover:text-purple-300",
            footerActionText: "text-zinc-400",
            identityPreviewText: "text-zinc-300",
            identityPreviewEditButton: "text-purple-400 hover:text-purple-300",
            formFieldAction: "text-purple-400 hover:text-purple-300",
            formFieldInputShowPasswordButton: "text-zinc-400 hover:text-zinc-300",
            alert: "bg-zinc-800 border-zinc-700",
            alertText: "text-zinc-300",
            formFieldErrorText: "text-red-400",
            formFieldSuccessText: "text-green-400",
            formFieldWarningText: "text-yellow-400",
            otpCodeFieldInput: "bg-zinc-800 border-zinc-700 text-white",
            phoneInputBox: "bg-zinc-800 border-zinc-700 text-white",
            selectButton: "bg-zinc-800 border-zinc-700 text-white",
            selectOptionsContainer: "bg-zinc-800 border-zinc-700",
            selectOption: "text-white hover:bg-zinc-700",
            badge: "bg-purple-600 text-white",
            avatarBox: "bg-zinc-700",
            userButtonPopoverCard: "bg-zinc-900 border-zinc-800",
            userButtonPopoverActionButton: "text-zinc-300 hover:bg-zinc-800",
            userButtonPopoverActionButtonText: "text-zinc-300",
            userButtonPopoverFooter: "border-zinc-800",
            modalContent: "bg-zinc-900 border-zinc-800",
            modalCloseButton: "text-zinc-400 hover:text-white",
            navbar: "bg-zinc-900 border-zinc-800",
            navbarButton: "text-zinc-300 hover:bg-zinc-800",
            profileSectionTitle: "text-white",
            profileSectionContent: "text-zinc-300",
            formResendCodeLink: "text-purple-400 hover:text-purple-300",
            alternativeMethodsBlockButton: "text-zinc-300 hover:bg-zinc-800 border-zinc-700",
            backLink: "text-purple-400 hover:text-purple-300",
          },
          variables: {
            colorPrimary: "#9333ea",
            colorBackground: "#18181b",
            colorText: "#ffffff",
            colorTextSecondary: "#a1a1aa",
            colorInputBackground: "#27272a",
            colorInputText: "#ffffff",
            colorDanger: "#f87171",
            colorSuccess: "#4ade80",
            colorWarning: "#fbbf24",
          },
        }}
      />
    </div>
  );
}
