import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';

export function useWidgetLayout(userId) {
  const [layout, setLayout] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLayout = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_widgets')
        .select('*')
        .eq('user_id', userId);
        
      if (error) throw error;
      setLayout(data || []);
    } catch (err) {
      console.error('Error fetching widget layout:', err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchLayout();
  }, [fetchLayout]);

  const saveLayout = async (newLayout) => {
    if (!userId) return;
    
    // In a real app with many widgets, we might just delete and re-insert, 
    // or upsert. Let's do a simple delete all and insert approach to ensure exact sync.
    try {
      const { error: deleteError } = await supabase
        .from('user_widgets')
        .delete()
        .eq('user_id', userId);
        
      if (deleteError) throw deleteError;

      const itemsToInsert = newLayout.map(item => ({
        user_id: userId,
        widget_type: item.widget_type,
        grid_x: item.grid_x,
        grid_y: item.grid_y,
        width: item.width,
        height: item.height
      }));

      if (itemsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('user_widgets')
          .insert(itemsToInsert);
          
        if (insertError) throw insertError;
      }
      
      setLayout(newLayout);
    } catch (err) {
      console.error('Error saving widget layout:', err.message);
    }
  };

  return { layout, loading, saveLayout, fetchLayout };
}
