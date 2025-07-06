// src/app/(protectd)/_components/subscription-plan.tsx

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle, Crown, Star, Zap } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SubscriptionPlanProps {
  userPlan?: string; // Used to highlight the currently active plan
}

export function SubscriptionPlan({ userPlan }: SubscriptionPlanProps) {
  const [isYearly, setIsYearly] = useState(false);
  const [hoveredPlan, setHoveredPlan] = useState<number | null>(null);
  const [hoveredFeature, setHoveredFeature] = useState<string | null>(null);
  const containerRef = useRef(null);
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';

  // State to control if the component has mounted on the client
  const [mounted, setMounted] = useState(false);

  // useEffect to set 'mounted' to true after the first client-side render
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubscription = (checkoutUrl: string) => {
    console.log("Redirecionando para o checkout da Hotmart:", checkoutUrl);
    window.location.href = checkoutUrl;
  };

  const formatCurrency = (value: number): string => {
    return `R$${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const rawPlans = [
    {
      name: "Starter",
      icon: <Zap className="w-6 h-6" />,
      annualPriceValue: 1299.00,
      monthlyPriceValue: 129.90,
      description: "Ideal para iniciantes e pequenos negócios",
      color: "from-blue-500 to-cyan-400",
      features: [
        "15.000 mensagens/mês",
        "1.000 leads/mês",
        "2 automações ativas",
        "Suporte por email",
        "Analytics básico",
        "Aquecedor básico",
      ],
      checkoutUrlMonthly: "https://pay.hotmart.com/K99734443S?off=6dzaxpbx&checkoutMode=10",
      checkoutUrlYearly: "https://pay.hotmart.com/K99734443S?off=496h6ukc&checkoutMode=6",
    },
    {
      name: "Pro",
      icon: <Star className="w-6 h-6" />,
      annualPriceValue: 2499.00,
      monthlyPriceValue: 249.90,
      popular: true,
      description:
        "Perfeito para usuários que precisam de mais recursos e suporte prioritário",
      color: "from-violet-500 to-purple-500",
      features: [
        "2 Agentes de IA",
        "50.000 mensagens/mês",
        "5.000 leads/mês",
        "Automações ilimitadas",
        "Suporte prioritário",
        "Analytics avançado",
        "API completa",
        "Aquecedor avançado",
        "Integrações premium",
      ],
      checkoutUrlMonthly: "https://pay.hotmart.com/K99734443S?off=yfn3498r&checkoutMode=6",
      checkoutUrlYearly: "https://pay.hotmart.com/K99734443S?off=unhl7sd0&checkoutMode=6",
    },
    {
      name: "Enterprise",
      icon: <Crown className="w-6 h-6" />,
      annualPriceValue: 4999.00,
      monthlyPriceValue: 499.90,
      description:
        "Solução completa para grandes empresas e necessidades complexas",
      color: "from-orange-500 to-pink-500",
      features: [
        "Agentes ilimitados",
        "Disparos ilimitados",
        "Mensagens ilimitadas",
        "Automações ilimitadas",
        "Leads ilimitados",
        "Recursos exclusivos",
        "Suporte 24/7 VIP",
        "Analytics personalizado",
        "API dedicada",
        "Setup assistido",
        "Integrações personalizadas",
        "Aquecedor personalizado",
        "Treinamento da equipe",
      ],
      checkoutUrlMonthly: "https://pay.hotmart.com/K99734443S?off=rxy4yhqx&checkoutMode=6",
      checkoutUrlYearly: "https://pay.hotmart.com/K99734443S?off=vi4ma9kh&checkoutMode=6",
    },
  ];

  const plans = rawPlans.map(plan => {
    const displayedPrice = isYearly
      ? formatCurrency(plan.annualPriceValue)
      : formatCurrency(plan.monthlyPriceValue);

    const equivalentMonthlyPrice = isYearly
      ? formatCurrency(plan.annualPriceValue / 12)
      : null;

    const checkoutUrl = isYearly ? plan.checkoutUrlYearly : plan.checkoutUrlMonthly;

    return {
      ...plan,
      price: displayedPrice,
      monthlyPriceEquivalent: equivalentMonthlyPrice,
      checkoutUrl: checkoutUrl,
    };
  });

  const toggleTextColorActive = isDarkMode ? '#e5e7eb' : '#374151';
  const toggleTextColorInactive = isDarkMode ? '#9ca3af' : '#9ca3af';

  // Determine the background class dynamically for SSR compatibility
  const dynamicBackgroundClass = mounted
    ? (isDarkMode ? 'bg-gradient-to-br from-deep-purple via-deep to-deep-purple/90' : 'bg-background')
    : 'bg-background'; // Fallback for SSR

  // Store random values for animations in a useRef to ensure persistence
  const randomAnimations = useRef<Array<{ x: string[], y: string[], duration: number }>>([]);

  useEffect(() => {
    if (mounted && randomAnimations.current.length === 0) {
      for (let i = 0; i < 30; i++) {
        randomAnimations.current.push({
          y: ["0vh", "100vh"],
          x: [`${Math.random() * 100}vw`, `${Math.random() * 100}vw`],
          duration: Math.random() * 10 + 20,
        });
      }
    }
  }, [mounted]);

  return (
    <div
      ref={containerRef}
      id="precos"
      className={cn(
        "min-h-screen pt-0 pb-16 px-4 relative overflow-hidden",
        dynamicBackgroundClass
      )}
    >
      {/* Conditionally render animated dots only on the client */}
      {mounted && [...Array(30)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-secondary/30 rounded-full"
          animate={{
            y: randomAnimations.current[i]?.y,
            x: randomAnimations.current[i]?.x,
          }}
          transition={{
            duration: randomAnimations.current[i]?.duration,
            repeat: Number.POSITIVE_INFINITY,
            ease: "linear",
          }}
        />
      ))}
      <div className="max-w-6xl mx-auto relative z-10">
        <motion.div
          className="text-center space-y-3 mb-12"
        >
          {/* <motion.div
            animate={{
              scale: [1, 1.02, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{ duration: 5, repeat: Number.POSITIVE_INFINITY }}
            className="inline-block"
          >
            <h2 className="text-2xl md:text-3xl lg:text-5xl font-bold leading-tight">
              <span className="bg-gradient-to-r from-blue-500 to-gray-400 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">
                Escolha o Plano
              </span>
              <br />
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Ideal para Você
              </span>
            </h2>
          </motion.div> */}
          {/* Price Toggle */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center justify-center gap-4"
          >
            {/* "Mensal" Text with color animation */}
            <motion.span
              animate={{ color: isYearly ? toggleTextColorInactive : toggleTextColorActive }}
              className="text-base transition-colors duration-300"
            >
              Mensal
            </motion.span>
            {/* Toggle Button */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsYearly(!isYearly)}
              className="relative w-16 h-8 rounded-full bg-gradient-to-r from-primary to-secondary p-1 flex items-center"
            >
              <motion.div
                animate={{ x: isYearly ? 32 : 0 }}
                transition={{ type: "spring", stiffness: 700, damping: 30 }}
                className="w-8 h-8 rounded-full bg-white shadow-lg"
              />
            </motion.button>
            {/* "Anual" Text with color animation */}
            <motion.span
              animate={{ color: isYearly ? toggleTextColorActive : toggleTextColorInactive }}
              className="text-lg transition-colors duration-300"
            >
              Anual
            </motion.span>
            {/* "Economize 20%" Badge with AnimatePresence */}
            <AnimatePresence>
              {isYearly && (
                <motion.span
                  key="save-badge"
                  initial={{ opacity: 0, scale: 0.8, x: -10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.8, x: -10 }}
                  transition={{ duration: 0.3 }}
                  className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-sm font-medium bg-gradient-to-r from-green-400 to-emerald-500 text-white dark:from-green-600 dark:to-emerald-700 dark:text-gray-100"
                >
                  Economize 20%
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto items-stretch">
          <AnimatePresence>
            {plans.filter(Boolean).map((plan, index) => {
              const isActivePlan = userPlan?.toLowerCase() === plan.name.toLowerCase();
              return (
                <motion.div
                  key={plan.name}
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 50 }}
                  transition={{ delay: index * 0.2 }}
                  onHoverStart={() => setHoveredPlan(index)}
                  onHoverEnd={() => setHoveredPlan(null)}
                  className="relative group"
                >
                  {/* Main Card Content */}
                  <motion.div
                    animate={
                      hoveredPlan === index ? { scale: 1.05 } : { scale: 1 }
                    }
                    transition={{ duration: 0.3 }}
                    className={cn(
                      "relative p-8 rounded-2xl",
                      "bg-card backdrop-blur-xl",
                      "border border-border",
                      plan.popular && "ring-2 ring-green-500",
                      isActivePlan && "ring-2 ring-green-500 dark:ring-green-400",
                      "h-full flex flex-col"
                    )}
                  >
                    {(plan.popular || isActivePlan) && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute -top-5 left-1/2 transform -translate-x-1/2"
                      >
                        <Badge className={cn(
                          "px-4 py-1 rounded-full text-sm font-medium",
                          plan.popular
                            ? "bg-gradient-to-r from-green-500 to-secondary text-white dark:from-green-500 dark:to-secondary dark:text-white"
                            : "bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-700 dark:text-green-100 dark:hover:bg-green-700"
                        )}>
                          {isActivePlan ? "Seu Plano Atual" : "Mais Popular"}
                        </Badge>
                      </motion.div>
                    )}
                    <div
                      className={cn(
                        "w-16 h-16 rounded-xl mb-6",
                        "flex items-center justify-center",
                        `bg-gradient-to-r ${plan.color}`
                      )}
                    >
                      {plan.icon}
                    </div>
                    <h3 className="text-2xl font-bold text-foreground mb-2">
                      {plan.name}
                    </h3>
                    <div className="flex items-baseline gap-1 mb-6">
                      <span className="text-4xl font-bold text-foreground">
                        {plan.price}
                      </span>
                      <span className="text-muted-foreground">
                        /{isYearly ? "ano" : "mês"}
                      </span>
                    </div>
                    {isYearly && plan.monthlyPriceEquivalent && (
                      <div className="text-sm text-green-500 dark:text-green-400 mb-4">
                        Equivalente a {plan.monthlyPriceEquivalent}/mês
                      </div>
                    )}
                    <p className="text-muted-foreground text-sm mb-8">
                      {plan.description}
                    </p>
                    <ul className="space-y-4 mb-8 flex-grow">
                      {plan.features.map((feature, i) => (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          onHoverStart={() => setHoveredFeature(feature)}
                          onHoverEnd={() => setHoveredFeature(null)}
                          className="flex items-center gap-3 text-muted-foreground"
                        >
                          <CheckCircle className="w-5 h-5 text-green-500" />
                          <span
                            className={cn(
                              "transition-colors duration-200",
                              hoveredFeature === feature && 'text-primary'
                            )}
                          >
                            {feature}
                          </span>
                        </motion.li>
                      ))}
                    </ul>
                    {/* Call to Action Button */}
                    <Button
                      onClick={() => handleSubscription(plan.checkoutUrl)}
                      variant={isActivePlan ? "default" : "magic"}
                      className={cn(
                        "w-full mt-auto",
                        isActivePlan && "py-3 text-lg font-semibold bg-green-500 hover:bg-green-600 text-white dark:bg-green-700 dark:hover:bg-green-800 dark:text-gray-100"
                      )}
                    >
                      {isActivePlan ? (
                        <>
                          Plano Atual
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </>
                      ) : (
                        <>
                          <p>Assinar Agora</p>
                          <ArrowRight size={20} />
                        </>
                      )}
                    </Button>
                  </motion.div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
