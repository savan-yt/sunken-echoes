
-- Create lobbies table for co-op rooms
CREATE TABLE public.lobbies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code TEXT NOT NULL UNIQUE,
  host_name TEXT NOT NULL,
  host_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'closed')),
  max_players INT NOT NULL DEFAULT 2,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lobby_players table
CREATE TABLE public.lobby_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lobby_id UUID NOT NULL REFERENCES public.lobbies(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  player_id TEXT NOT NULL,
  is_ready BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lobby_id, player_id)
);

-- Enable RLS
ALTER TABLE public.lobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lobby_players ENABLE ROW LEVEL SECURITY;

-- Public read/write for lobbies (anonymous game, no auth required)
CREATE POLICY "Anyone can view lobbies" ON public.lobbies FOR SELECT USING (true);
CREATE POLICY "Anyone can create lobbies" ON public.lobbies FOR INSERT WITH CHECK (true);
CREATE POLICY "Hosts can update their lobbies" ON public.lobbies FOR UPDATE USING (true);
CREATE POLICY "Hosts can delete their lobbies" ON public.lobbies FOR DELETE USING (true);

CREATE POLICY "Anyone can view lobby players" ON public.lobby_players FOR SELECT USING (true);
CREATE POLICY "Anyone can join lobbies" ON public.lobby_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Players can update themselves" ON public.lobby_players FOR UPDATE USING (true);
CREATE POLICY "Players can leave lobbies" ON public.lobby_players FOR DELETE USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.lobbies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lobby_players;
