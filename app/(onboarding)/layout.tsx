interface OnBoardingLayoutProps {
  children: React.ReactNode
}

export default function OnBoardingLayout({ children }: OnBoardingLayoutProps) {
  return <div className="min-h-screen">{children}</div>
}
