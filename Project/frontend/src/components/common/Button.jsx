export default function Button({
  variant = "primary",
  size = "md",
  type = "button",
  icon: Icon,
  children,
  className = "",
  disabled,
  block,
  ...rest
}) {
  const classes = [
    "btn",
    variant === "primary" && "btn-primary",
    variant === "ghost" && "btn-ghost",
    variant === "outline" && "btn-outline-accent",
    variant === "danger" && "btn-danger",
    size === "sm" && "btn-sm",
    size === "lg" && "btn-lg",
    block && "btn-block",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} disabled={disabled} {...rest}>
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}
