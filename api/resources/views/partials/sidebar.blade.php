@php
    $currentRoute = request()->route()?->getName();
    $activeTab = collect(config('menu'))->search(fn ($tab) => collect($tab['items'])->contains(
        fn ($item) => $sidebarMatches($item, $currentRoute)
    )) ?: 'menu';
@endphp
<div id="left-sidebar" class="sidebar">
    <div class="sidebar-scroll">
        <div class="user-account">
            <div class="dropdown">
                <a href="javascript:void(0);" class="dropdown-toggle user-name" data-toggle="dropdown"><strong>{{ strtoupper(auth()->user()->company->name) }}</strong></a>
                <ul class="dropdown-menu dropdown-menu-right account list-unstyled">
                    <li><a href="javascript:;"><i class="icon-user"></i>My Profile</a></li>
                    <li><a href="{{ route('settings.company') }}"><i class="icon-settings"></i>Settings</a></li>
                    <li class="divider"></li>
                    <li>
                        <form method="POST" action="{{ route('logout') }}">
                            @csrf
                            <a href="#" onclick="this.closest('form').submit(); return false;"><i class="icon-power"></i>Logout</a>
                        </form>
                    </li>
                </ul>
            </div>
        </div>

        <ul class="nav nav-tabs">
            @foreach (config('menu') as $tabId => $tab)
                <li class="nav-item"><a class="nav-link {{ $activeTab === $tabId ? 'active' : '' }}" data-toggle="tab" href="#{{ $tabId }}">{{ $tab['label'] }}</a></li>
            @endforeach
        </ul>

        <div class="tab-content p-l-0 p-r-0">
            @foreach (config('menu') as $tabId => $tab)
                <div class="tab-pane {{ $activeTab === $tabId ? 'active' : '' }}" id="{{ $tabId }}">
                    <nav class="sidebar-nav">
                        <ul class="metismenu">
                            @foreach ($tab['items'] as $item)
                                @php $isActive = $sidebarMatches($item, $currentRoute); @endphp
                                @if (isset($item['children']))
                                    <li class="{{ $isActive ? 'active open' : '' }}">
                                        <a href="#" class="has-arrow js-menu-toggle"><i class="{{ $item['icon'] }}"></i> <span>{{ $item['label'] }}</span></a>
                                        <ul class="collapse">
                                            @foreach ($item['children'] as $child)
                                                <li class="{{ $sidebarMatches($child, $currentRoute) ? 'active' : '' }}"><a href="{{ route($child['route']) }}">{{ $child['label'] }}</a></li>
                                            @endforeach
                                        </ul>
                                    </li>
                                @else
                                    <li class="{{ $isActive ? 'active' : '' }}">
                                        <a href="{{ route($item['route']) }}"><i class="{{ $item['icon'] }}"></i> <span>{{ $item['label'] }}</span></a>
                                    </li>
                                @endif
                            @endforeach
                        </ul>
                    </nav>
                </div>
            @endforeach
        </div>
    </div>
</div>
