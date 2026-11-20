// hooks >  useSellerId.ts
import { useAuth } from "contexts/AuthContext";

export const useSellerId = () => {
  const { user } = useAuth();
  return user?._id ?? null;
};