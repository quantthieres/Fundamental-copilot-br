import AppHeader from "@/components/layout/AppHeader";

interface NavBarProps {
  onSelectCompany?: (ticker: string) => void;
  selectedTicker?: string;
}

export default function NavBar({ onSelectCompany, selectedTicker }: NavBarProps) {
  return (
    <AppHeader
      showSearch={!!onSelectCompany}
      onSelectCompany={onSelectCompany}
      selectedTicker={selectedTicker}
    />
  );
}
