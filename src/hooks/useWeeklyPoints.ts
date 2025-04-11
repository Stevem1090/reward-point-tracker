
import { useState, useEffect } from 'react';
import { getWeeklyPoints } from '@/utils/summaryUtils';

export const useWeeklyPoints = (selectedDate: Date, shouldRefresh: any) => {
  const [weeklyPoints, setWeeklyPoints] = useState<number>(0);
  const [isLoadingWeekly, setIsLoadingWeekly] = useState<boolean>(true);

  useEffect(() => {
    const fetchWeeklyPoints = async () => {
      setIsLoadingWeekly(true);
      try {
        const points = await getWeeklyPoints(selectedDate);
        setWeeklyPoints(points);
      } catch (error) {
        console.error('Error fetching weekly points:', error);
      } finally {
        setIsLoadingWeekly(false);
      }
    };

    fetchWeeklyPoints();
  }, [selectedDate, shouldRefresh]);

  return { weeklyPoints, isLoadingWeekly };
};
