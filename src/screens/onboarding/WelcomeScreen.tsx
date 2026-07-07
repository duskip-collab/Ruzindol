import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Users } from "lucide-react";

export function WelcomeScreen({ onNext }: { onNext: () => void }) {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-orange-400 px-6 text-white">
      {/* floating blobs */}
      <motion.div
        aria-hidden
        className="absolute -top-20 -left-16 h-64 w-64 rounded-full bg-white/30 blur-3xl"
        animate={{ y: [0, 20, 0], x: [0, 10, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute -bottom-24 -right-10 h-72 w-72 rounded-full bg-white/20 blur-3xl"
        animate={{ y: [0, -25, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 flex w-full max-w-sm flex-col items-center gap-6 rounded-3xl border border-white/30 bg-white/15 p-8 text-center shadow-2xl backdrop-blur-2xl"
      >
        <motion.div
          initial={{ rotate: -10, scale: 0.6, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/30 backdrop-blur-xl"
        >
          <Users className="h-8 w-8" />
        </motion.div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vitaj v Komunite</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/90">
            Miesto, kde susedia zdieľajú, pomáhajú si a spoznávajú sa. Bez reklám,
            bez sledovania — len tvoja obec.
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Nová generácia lokálnej siete</span>
        </div>

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onNext}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-semibold text-neutral-900 shadow-lg"
        >
          Začíname
          <ArrowRight className="h-4 w-4" />
        </motion.button>
      </motion.div>
    </div>
  );
}
