import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ProjectorPage = () => {
  const [searchParams] = useSearchParams();
  const dateParam = searchParams.get('data') || format(new Date(), 'yyyy-MM-dd');
  const [prezenti, setPrezenti] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(`${API_URL}/proiector/${dateParam}`);
        const data = response.data.prezenti || [];
        
        // Shuffle array randomly (Fisher-Yates algorithm)
        const shuffled = [...data];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        setPrezenti(shuffled);
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateParam]);

  const formattedDate = format(new Date(dateParam + 'T00:00:00'), "EEEE, d MMMM yyyy", { locale: ro });
  const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-2xl text-zinc-500">Se încarcă...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-8">
      {/* Date and Total */}
      <div className="text-center mb-8">
        <p className="text-2xl text-zinc-700">{capitalizedDate}</p>
        <p className="text-xl text-zinc-500 mt-1">
          Total: <span className="font-bold text-zinc-900">{prezenti.length}</span>
        </p>
      </div>

      {/* 6-column grid */}
      {prezenti.length > 0 ? (
        <div className="grid grid-cols-6 gap-2 max-w-7xl mx-auto">
          {prezenti.map((persoana, index) => (
            <div 
              key={index} 
              className="bg-zinc-50 border border-zinc-200 rounded px-3 py-2 text-base whitespace-nowrap overflow-hidden"
            >
              <span className="font-bold">{index + 1}.</span> {persoana.prenume} {persoana.nume}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-xl text-zinc-500">Nu există persoane prezente.</p>
        </div>
      )}
    </div>
  );
};

export default ProjectorPage;
