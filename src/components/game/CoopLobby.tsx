import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LobbyPlayer {
  id: string;
  player_name: string;
  player_id: string;
  is_ready: boolean;
}

interface Lobby {
  id: string;
  room_code: string;
  host_name: string;
  host_id: string;
  status: string;
  max_players: number;
}

type CoopView = 'menu' | 'create' | 'join' | 'lobby' | 'browse';

interface CoopLobbyProps {
  onBack: () => void;
  onStartGame: () => void;
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function getPlayerId(): string {
  let id = localStorage.getItem('fd_player_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('fd_player_id', id);
  }
  return id;
}

export default function CoopLobby({ onBack, onStartGame }: CoopLobbyProps) {
  const [view, setView] = useState<CoopView>('menu');
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('fd_player_name') || '');
  const [roomCode, setRoomCode] = useState('');
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [error, setError] = useState('');
  const [isReady, setIsReady] = useState(false);

  const playerId = getPlayerId();
  const isHost = lobby?.host_id === playerId;

  // Save player name
  useEffect(() => {
    if (playerName) localStorage.setItem('fd_player_name', playerName);
  }, [playerName]);

  // Subscribe to lobby players
  useEffect(() => {
    if (!lobby) return;

    const fetchPlayers = async () => {
      const { data } = await supabase
        .from('lobby_players')
        .select('*')
        .eq('lobby_id', lobby.id);
      if (data) setPlayers(data);
    };
    fetchPlayers();

    const channel = supabase
      .channel(`lobby-${lobby.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lobby_players', filter: `lobby_id=eq.${lobby.id}` }, () => {
        fetchPlayers();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobby.id}` }, (payload) => {
        const updated = payload.new as Lobby;
        setLobby(updated);
        if (updated.status === 'in_progress') {
          onStartGame();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [lobby?.id, onStartGame]);

  const handleCreate = useCallback(async () => {
    if (!playerName.trim()) { setError('Enter a name, diver'); return; }
    setError('');
    const code = generateRoomCode();

    const { data: lobbyData, error: lobbyErr } = await supabase
      .from('lobbies')
      .insert({ room_code: code, host_name: playerName.trim(), host_id: playerId })
      .select()
      .single();

    if (lobbyErr || !lobbyData) { setError('Failed to create room'); return; }

    await supabase.from('lobby_players').insert({
      lobby_id: lobbyData.id,
      player_name: playerName.trim(),
      player_id: playerId,
    });

    setLobby(lobbyData);
    setView('lobby');
  }, [playerName, playerId]);

  const handleJoin = useCallback(async () => {
    if (!playerName.trim()) { setError('Enter a name, diver'); return; }
    if (!roomCode.trim()) { setError('Enter a room code'); return; }
    setError('');

    const { data: lobbyData } = await supabase
      .from('lobbies')
      .select('*')
      .eq('room_code', roomCode.trim().toUpperCase())
      .eq('status', 'waiting')
      .single();

    if (!lobbyData) { setError('Room not found or already started'); return; }

    const { data: existingPlayers } = await supabase
      .from('lobby_players')
      .select('*')
      .eq('lobby_id', lobbyData.id);

    if (existingPlayers && existingPlayers.length >= lobbyData.max_players) {
      setError('Room is full'); return;
    }

    await supabase.from('lobby_players').upsert({
      lobby_id: lobbyData.id,
      player_name: playerName.trim(),
      player_id: playerId,
    });

    setLobby(lobbyData);
    setView('lobby');
  }, [playerName, roomCode, playerId]);

  const handleBrowse = useCallback(async () => {
    const { data } = await supabase
      .from('lobbies')
      .select('*')
      .eq('status', 'waiting')
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setLobbies(data);
    setView('browse');
  }, []);

  const handleQuickJoin = useCallback(async (targetLobby: Lobby) => {
    if (!playerName.trim()) { setError('Enter a name first'); return; }
    setRoomCode(targetLobby.room_code);
    
    await supabase.from('lobby_players').upsert({
      lobby_id: targetLobby.id,
      player_name: playerName.trim(),
      player_id: playerId,
    });

    setLobby(targetLobby);
    setView('lobby');
  }, [playerName, playerId]);

  const handleReady = useCallback(async () => {
    const newReady = !isReady;
    setIsReady(newReady);
    await supabase
      .from('lobby_players')
      .update({ is_ready: newReady })
      .eq('lobby_id', lobby!.id)
      .eq('player_id', playerId);
  }, [isReady, lobby, playerId]);

  const handleStartGame = useCallback(async () => {
    if (!lobby || !isHost) return;
    await supabase.from('lobbies').update({ status: 'in_progress' }).eq('id', lobby.id);
  }, [lobby, isHost]);

  const handleLeave = useCallback(async () => {
    if (lobby) {
      await supabase.from('lobby_players').delete().eq('lobby_id', lobby.id).eq('player_id', playerId);
      if (isHost) {
        await supabase.from('lobbies').delete().eq('id', lobby.id);
      }
    }
    setLobby(null);
    setIsReady(false);
    setView('menu');
  }, [lobby, playerId, isHost]);

  const allReady = players.length >= 2 && players.every(p => p.is_ready);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/90 backdrop-blur-sm" />
      
      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="font-pixel text-lg text-primary glow-cyan tracking-wider">CO-OP</h2>
          <div className="w-24 h-px mx-auto bg-gradient-to-r from-transparent via-primary/50 to-transparent mt-2" />
        </div>

        <div className="pixel-border bg-card/80 backdrop-blur p-6 space-y-4">
          {error && (
            <div className="font-pixel text-[8px] text-destructive bg-destructive/10 px-3 py-2 pixel-border">
              {error}
            </div>
          )}

          {/* Name input (always visible except in lobby) */}
          {view !== 'lobby' && (
            <div>
              <label className="font-pixel text-[8px] text-muted-foreground block mb-2">DIVER NAME</label>
              <input
                type="text"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="Enter your name..."
                maxLength={16}
                className="w-full bg-secondary/50 pixel-border px-3 py-2 font-pixel-body text-sm text-foreground 
                  placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
              />
            </div>
          )}

          {/* Menu View */}
          {view === 'menu' && (
            <div className="space-y-3 pt-2">
              <button onClick={() => setView('create')} className="w-full font-pixel text-[9px] text-primary glow-cyan
                px-4 py-3 pixel-border bg-secondary/30 hover:bg-primary/20 transition-all duration-300">
                🔱 CREATE ROOM
              </button>
              <button onClick={() => setView('join')} className="w-full font-pixel text-[9px] text-foreground
                px-4 py-3 pixel-border bg-secondary/30 hover:bg-primary/20 transition-all duration-300">
                🔗 JOIN WITH CODE
              </button>
              <button onClick={handleBrowse} className="w-full font-pixel text-[9px] text-foreground
                px-4 py-3 pixel-border bg-secondary/30 hover:bg-primary/20 transition-all duration-300">
                🌊 BROWSE ROOMS
              </button>
              <button onClick={onBack} className="w-full font-pixel text-[8px] text-muted-foreground
                px-4 py-2 hover:text-foreground transition-colors mt-2">
                ← BACK
              </button>
            </div>
          )}

          {/* Create View */}
          {view === 'create' && (
            <div className="space-y-3 pt-2">
              <p className="font-pixel text-[7px] text-muted-foreground text-center">
                Create a private room and share the code with your dive partner
              </p>
              <button onClick={handleCreate} className="w-full font-pixel text-[9px] text-primary glow-cyan
                px-4 py-3 pixel-border bg-secondary/30 hover:bg-primary/20 transition-all duration-300">
                CREATE & GET CODE
              </button>
              <button onClick={() => { setView('menu'); setError(''); }} className="w-full font-pixel text-[8px] text-muted-foreground
                px-4 py-2 hover:text-foreground transition-colors">
                ← BACK
              </button>
            </div>
          )}

          {/* Join View */}
          {view === 'join' && (
            <div className="space-y-3 pt-2">
              <div>
                <label className="font-pixel text-[8px] text-muted-foreground block mb-2">ROOM CODE</label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="XXXXX"
                  maxLength={5}
                  className="w-full bg-secondary/50 pixel-border px-3 py-2 font-pixel text-sm text-center text-primary
                    tracking-[0.3em] placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
                />
              </div>
              <button onClick={handleJoin} className="w-full font-pixel text-[9px] text-primary glow-cyan
                px-4 py-3 pixel-border bg-secondary/30 hover:bg-primary/20 transition-all duration-300">
                JOIN ROOM
              </button>
              <button onClick={() => { setView('menu'); setError(''); }} className="w-full font-pixel text-[8px] text-muted-foreground
                px-4 py-2 hover:text-foreground transition-colors">
                ← BACK
              </button>
            </div>
          )}

          {/* Browse View */}
          {view === 'browse' && (
            <div className="space-y-3 pt-2">
              {lobbies.length === 0 ? (
                <p className="font-pixel text-[8px] text-muted-foreground text-center py-4">
                  No rooms available. Create one!
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {lobbies.map(l => (
                    <button
                      key={l.id}
                      onClick={() => handleQuickJoin(l)}
                      className="w-full flex items-center justify-between px-3 py-2 pixel-border bg-secondary/20 
                        hover:bg-primary/10 transition-all duration-200"
                    >
                      <div className="text-left">
                        <span className="font-pixel text-[8px] text-primary">{l.room_code}</span>
                        <span className="font-pixel-body text-xs text-muted-foreground ml-3">
                          by {l.host_name}
                        </span>
                      </div>
                      <span className="font-pixel text-[7px] text-accent">JOIN →</span>
                    </button>
                  ))}
                </div>
              )}
              <button onClick={() => handleBrowse()} className="w-full font-pixel text-[8px] text-muted-foreground
                px-4 py-2 hover:text-foreground transition-colors">
                🔄 REFRESH
              </button>
              <button onClick={() => { setView('menu'); setError(''); }} className="w-full font-pixel text-[8px] text-muted-foreground
                px-4 py-2 hover:text-foreground transition-colors">
                ← BACK
              </button>
            </div>
          )}

          {/* Lobby View */}
          {view === 'lobby' && lobby && (
            <div className="space-y-4">
              {/* Room Code Display */}
              <div className="text-center py-3 bg-secondary/30 pixel-border">
                <p className="font-pixel text-[7px] text-muted-foreground mb-1">ROOM CODE</p>
                <p className="font-pixel text-lg text-primary glow-cyan tracking-[0.4em]">
                  {lobby.room_code}
                </p>
                <p className="font-pixel text-[6px] text-muted-foreground/60 mt-1">
                  Share this code with your dive partner
                </p>
              </div>

              {/* Players */}
              <div>
                <p className="font-pixel text-[8px] text-muted-foreground mb-2">
                  DIVERS ({players.length}/{lobby.max_players})
                </p>
                <div className="space-y-2">
                  {players.map(p => (
                    <div key={p.id} className="flex items-center justify-between px-3 py-2 bg-secondary/20 pixel-border">
                      <div className="flex items-center gap-2">
                        <span className="font-pixel text-[7px]">
                          {p.player_id === lobby.host_id ? '👑' : '🤿'}
                        </span>
                        <span className="font-pixel-body text-sm text-foreground">{p.player_name}</span>
                      </div>
                      <span className={`font-pixel text-[7px] ${p.is_ready ? 'text-accent' : 'text-muted-foreground/50'}`}>
                        {p.is_ready ? '● READY' : '○ WAITING'}
                      </span>
                    </div>
                  ))}
                  {Array.from({ length: lobby.max_players - players.length }).map((_, i) => (
                    <div key={`empty-${i}`} className="flex items-center px-3 py-2 bg-secondary/10 pixel-border border-dashed opacity-40">
                      <span className="font-pixel text-[7px] text-muted-foreground">Waiting for diver...</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2">
                <button onClick={handleReady}
                  className={`w-full font-pixel text-[9px] px-4 py-3 pixel-border transition-all duration-300
                    ${isReady
                      ? 'text-accent bg-accent/10 hover:bg-accent/20'
                      : 'text-foreground bg-secondary/30 hover:bg-primary/20'}`}
                >
                  {isReady ? '✓ READY' : 'MARK READY'}
                </button>

                {isHost && (
                  <button onClick={handleStartGame} disabled={!allReady}
                    className={`w-full font-pixel text-[9px] px-4 py-3 pixel-border transition-all duration-300
                      ${allReady
                        ? 'text-primary glow-cyan bg-primary/10 hover:bg-primary/20 animate-pulse-glow'
                        : 'text-muted-foreground/40 bg-secondary/10 cursor-not-allowed'}`}
                  >
                    {allReady ? '⚡ DESCEND TOGETHER' : 'WAITING FOR ALL READY...'}
                  </button>
                )}

                <button onClick={handleLeave} className="w-full font-pixel text-[8px] text-destructive/70
                  px-4 py-2 hover:text-destructive transition-colors">
                  {isHost ? '✕ CLOSE ROOM' : '✕ LEAVE ROOM'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
