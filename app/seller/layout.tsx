// Layout específico para todas las páginas del Seller Dashboard
// Fecha de modificación: 2025-01-19 - Sistema de layout independiente

import SellerLayout from "@/components/seller/SellerLayout";

interface SellerLayoutWrapperProps {
  children: React.ReactNode;
}

export default function SellerLayoutWrapper({
  children,
}: SellerLayoutWrapperProps) {
  return <SellerLayout>{children}</SellerLayout>;
}
