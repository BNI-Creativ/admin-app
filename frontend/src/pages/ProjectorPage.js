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
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API_URL}/attendance/${dateParam}`);
        const data = response.data;
        
        // Combine present members and guests
        const membriPrezenti = data.membri
          .filter(m => m.prezent)
          .map(m => ({
            prenume: m.prenume,
            nume: m.nume,
            tip: 'Membru'
          }));
        
        const invitatiPrezenti = data.invitati
          .filter(g => g.prezent)
          .map(g => ({
            prenume: g.prenume,
            nume: g.nume,
            tip: 'Invitat',
            companie: g.companie,
            invitat_de: g.invitat_de
          }));
        
        // Combine and sort alphabetically
        const allPrezenti = [...membriPrezenti, ...invitatiPrezenti].sort((a, b) => {
          const nameA = `${a.prenume} ${a.nume}`.toLowerCase();
          const nameB = `${b.prenume} ${b.nume}`.toLowerCase();
          return nameA.localeCompare(nameB);
        });
        
        setPrezenti(allPrezenti);
        setError(null);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Nu s-au putut încărca datele');
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

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-2xl text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-zinc-900 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Prezență
        </h1>
        <p className="text-2xl text-zinc-600">{capitalizedDate}</p>
        <p className="text-xl text-zinc-500 mt-2">
          Total prezenți: <span className="font-bold text-zinc-900">{prezenti.length}</span>
        </p>
      </div>

      {/* Table */}
      {prezenti.length > 0 ? (
        <div className="max-w-4xl mx-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-zinc-100">
                <th className="border-2 border-zinc-300 px-4 py-3 text-left text-lg font-bold w-16">Nr.</th>
                <th className="border-2 border-zinc-300 px-4 py-3 text-left text-lg font-bold">Prenume</th>
                <th className="border-2 border-zinc-300 px-4 py-3 text-left text-lg font-bold">Nume</th>
                <th className="border-2 border-zinc-300 px-4 py-3 text-left text-lg font-bold w-24">Tip</th>
              </tr>
            </thead>
            <tbody>
              {prezenti.map((persoana, index) => (
                <tr 
                  key={index} 
                  className={index % 2 === 0 ? 'bg-white' : 'bg-zinc-50'}
                >
                  <td className="border border-zinc-300 px-4 py-3 text-lg font-medium">
                    {index + 1}
                  </td>
                  <td className="border border-zinc-300 px-4 py-3 text-lg">
                    {persoana.prenume}
                  </td>
                  <td className="border border-zinc-300 px-4 py-3 text-lg">
                    {persoana.nume}
                  </td>
                  <td className="border border-zinc-300 px-4 py-3 text-lg">
                    <span className={`px-2 py-1 rounded text-sm font-medium ${
                      persoana.tip === 'Membru' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {persoana.tip}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-2xl text-zinc-500">Nu există persoane prezente pentru această dată.</p>
        </div>
      )}

      {/* Footer */}
      <div className="text-center mt-8 text-zinc-400 text-sm">
        Pagină generată automat • Actualizare: apasă F5
      </div>
    </div>
  );
};

export default ProjectorPage;
