import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useRole() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setIsAdmin(false); setIsSuperAdmin(false); setLoading(false); return; }

    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .then(({ data }) => {
        const roles = data?.map((r: any) => r.role) || [];
        const superAdmin = roles.includes('super_admin');
        setIsSuperAdmin(superAdmin);
        setIsAdmin(superAdmin || roles.includes('admin'));
        setLoading(false);
      });
  }, [user]);

  return { isAdmin, isSuperAdmin, loading };
}
