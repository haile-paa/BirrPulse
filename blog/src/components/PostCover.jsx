import PhoneFrame from './PhoneFrame'

export default function PostCover({ cover, className = '' }) {
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: `linear-gradient(135deg, ${cover.from}, ${cover.to})` }}>
      <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10" />
      <div className="absolute -left-6 bottom-8 h-24 w-24 rounded-full bg-white/10" />
      <div className="absolute left-1/2 top-[14%] w-[34%] min-w-[84px] -translate-x-1/2 rotate-[-6deg] transition-transform duration-500 group-hover:-translate-y-2 group-hover:rotate-[-2deg]">
        <PhoneFrame id={cover.shot} alt="" />
      </div>
    </div>
  )
}
