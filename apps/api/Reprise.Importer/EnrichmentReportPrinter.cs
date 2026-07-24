using Reprise.Application.Enrichment;

namespace Reprise.Importer;

/// <summary>Formata o relatório do enriquecimento TMDB para o console.</summary>
public static class EnrichmentReportPrinter
{
    public static void Print(TextWriter o, EnrichmentReport r)
    {
        o.WriteLine();
        o.WriteLine("========== RELATÓRIO DE ENRIQUECIMENTO — Reprise ==========");
        o.WriteLine();
        o.WriteLine("-- Casamento por tvdb_id --");
        o.WriteLine($"  Séries consideradas ....... {r.SeriesConsidered}");
        o.WriteLine($"  Casadas no TMDB ........... {r.SeriesMatched}");
        o.WriteLine($"  Não casadas ............... {r.SeriesUnmatched}");
        o.WriteLine();
        o.WriteLine("-- Catálogo --");
        o.WriteLine($"  Temporadas criadas ........ {r.SeasonsCreated}");
        o.WriteLine($"  Episódios criados ......... {r.EpisodesCreated}  (os que faltavam p/ 'próximo a assistir')");
        o.WriteLine($"  Episódios atualizados ..... {r.EpisodesUpdated}");
        o.WriteLine($"  Episódios reposicionados .. {r.EpisodesRenumbered}  (alinhados por ordem de exibição)");
        o.WriteLine($"  Runtimes preenchidos ...... {r.RuntimesFilled}");
        o.WriteLine($"  Sem posição no TMDB ....... {r.EpisodesNotFoundInTmdb}  (preservados, nada foi apagado)");
        o.WriteLine();

        if (r.OrderAligned.Count > 0)
        {
            o.WriteLine("-- Alinhadas por ordem de exibição (TVDB e TMDB numeram diferente) --");
            o.WriteLine("   O 1º episódio local virou o 1º do TMDB, o 2º virou o 2º, e assim por diante.");
            o.WriteLine("   As exibições seguem nos mesmos episódios — só as coordenadas mudaram.");
            foreach (var a in r.OrderAligned.OrderByDescending(x => x.EpisodesRenumbered))
                o.WriteLine($"  tvdb {a.TvdbId?.ToString() ?? "—",-8} {Truncate(a.Name, 34),-34} " +
                            $"{a.EpisodesRenumbered}/{a.LocalEpisodes} reposicionados" +
                            (a.EpisodesUnplaced > 0 ? $", {a.EpisodesUnplaced} sem posição" : ""));
            o.WriteLine();
        }

        if (r.Unmatched.Count > 0)
        {
            o.WriteLine("-- Séries não casadas (resolva com SeriesMatchOverride) --");
            foreach (var u in r.Unmatched)
                o.WriteLine($"  tvdb {u.TvdbId?.ToString() ?? "—",-8} {Truncate(u.ProvisionalName, 42),-42} {u.Reason}");
            o.WriteLine();
        }

        o.WriteLine("==========================================================");
        o.WriteLine();
    }

    private static string Truncate(string s, int max) => s.Length <= max ? s : s[..(max - 1)] + "…";
}
